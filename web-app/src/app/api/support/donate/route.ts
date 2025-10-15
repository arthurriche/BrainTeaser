import { NextResponse } from "next/server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const MIN_AMOUNT_CENTS = 10;
const MAX_AMOUNT_CENTS = 200;

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!STRIPE_SECRET_KEY) {
    return jsonError("Stripe is not configured", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const amountValue =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).amountCents ?? (body as Record<string, unknown>).amount
      : null;

  const amountNumeric =
    typeof amountValue === "number"
      ? amountValue
      : typeof amountValue === "string"
        ? Number.parseFloat(amountValue)
        : Number.NaN;

  if (!Number.isFinite(amountNumeric) || Number.isNaN(amountNumeric)) {
    return jsonError("Invalid amount");
  }

  const amountCents = Math.round(amountNumeric);
  if (amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return jsonError("Amount out of range");
  }

  const paymentMethodId = body && typeof body === "object" ? (body as Record<string, unknown>).paymentMethodId : null;
  if (!paymentMethodId || typeof paymentMethodId !== "string") {
    return jsonError("paymentMethodId is required");
  }

  const locale = body && typeof body === "object" && typeof (body as Record<string, unknown>).locale === "string"
    ? ((body as Record<string, unknown>).locale as string)
    : null;

  const params = new URLSearchParams();
  params.append("amount", amountCents.toString());
  params.append("currency", "eur");
  params.append("payment_method", paymentMethodId);
  params.append("confirmation_method", "manual");
  params.append("confirm", "true");
  params.append("description", "Enigmate support donation");
  params.append("metadata[type]", "donation");
  params.append("metadata[source]", "enigmate-web");
  if (locale) {
    params.append("metadata[locale]", locale);
  }

  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const result = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const errorMessage =
        (result && typeof result === "object" && "error" in result && result.error && typeof result.error === "object" && "message" in result.error
          ? (result.error as { message?: string }).message
          : null) ?? "Stripe payment failed";
      console.error("[SupportDonation] Stripe error", {
        status: stripeResponse.status,
        paymentMethodId,
        amountCents,
        error: errorMessage,
      });
      return jsonError(errorMessage, stripeResponse.status);
    }

    return NextResponse.json({
      clientSecret: typeof result?.client_secret === "string" ? result.client_secret : null,
      paymentIntentId: typeof result?.id === "string" ? result.id : null,
      status: typeof result?.status === "string" ? result.status : null,
      requiresAction: result?.status === "requires_action" || result?.status === "requires_confirmation",
      amount: typeof result?.amount === "number" ? result.amount : amountCents,
      currency: typeof result?.currency === "string" ? result.currency : "eur",
    });
  } catch (error) {
    console.error("[SupportDonation] Unexpected failure", error);
    return jsonError("Payment service unavailable", 502);
  }
}
