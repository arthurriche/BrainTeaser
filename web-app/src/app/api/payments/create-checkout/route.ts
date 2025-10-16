import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { PREMIUM_PRICES, RESOURCE_CATALOG, type ResourceSlug, SOCIAL_LINKS } from "@/lib/premium";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const DEFAULT_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type CheckoutKind = "single_riddle" | "subscription" | "resource";

type CheckoutPayload = {
  kind?: CheckoutKind;
  riddleId?: number;
  resourceSlug?: string;
  locale?: string;
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const isResourceSlug = (value: string): value is ResourceSlug =>
  Object.hasOwn(RESOURCE_CATALOG, value as ResourceSlug);

const appendLineItem = (
  params: URLSearchParams,
  {
    currency,
    amountCents,
    name,
    description,
    localeKey,
  }: {
    currency: string;
    amountCents: number;
    name: { en: string; fr: string };
    description: { en: string; fr: string };
    localeKey: "en" | "fr";
  },
) => {
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", currency);
  params.append("line_items[0][price_data][unit_amount]", String(amountCents));
  params.append("line_items[0][price_data][product_data][name]", name[localeKey]);
  params.append("line_items[0][price_data][product_data][description]", description[localeKey]);
};

export async function POST(request: Request) {
  if (!STRIPE_SECRET_KEY) {
    return jsonError("Stripe is not configured", 500);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return jsonError("Authentication required", 401);
  }

  let payload: CheckoutPayload;
  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const kind = payload.kind;
  if (!kind) {
    return jsonError("kind is required");
  }

  const localeKey: "en" | "fr" = payload.locale === "fr" ? "fr" : "en";
  const origin = request.headers.get("origin") ?? DEFAULT_ORIGIN;

  const params = new URLSearchParams();
  params.append("success_url", `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/payment/cancelled`);
  params.append("metadata[user_id]", session.user.id);
  params.append("metadata[kind]", kind);
  params.append("metadata[locale]", localeKey);
  params.append("metadata[instagram]", SOCIAL_LINKS.instagramHandle);
  params.set("metadata[return_to]", kind === "resource" ? "/resources" : "/riddle");
  params.append("allow_promotion_codes", "false");
  if (session.user.email) {
    params.append("customer_email", session.user.email);
  }
  params.append("locale", localeKey);

  if (kind === "single_riddle") {
    const riddleId = typeof payload.riddleId === "number" ? payload.riddleId : Number.NaN;
    if (!Number.isFinite(riddleId) || Number.isNaN(riddleId) || riddleId <= 0) {
      return jsonError("A valid riddleId is required to unlock feedback");
    }
    const { amountCents, currency, name, description } = PREMIUM_PRICES.single;
    params.append("mode", "payment");
    params.append("metadata[riddle_id]", String(riddleId));
    params.append("metadata[label]", `riddle:${riddleId}`);
    appendLineItem(params, { currency, amountCents, name, description, localeKey });
  } else if (kind === "subscription") {
    const { amountCents, currency, name, description } = PREMIUM_PRICES.subscription;
    params.append("mode", "subscription");
    params.append("metadata[label]", "subscription:monthly");
    appendLineItem(params, { currency, amountCents, name, description, localeKey });
    params.append("line_items[0][price_data][recurring][interval]", "month");
    params.append("line_items[0][price_data][recurring][interval_count]", "1");
  } else if (kind === "resource") {
    if (!payload.resourceSlug || typeof payload.resourceSlug !== "string" || !isResourceSlug(payload.resourceSlug)) {
      return jsonError("resourceSlug is required");
    }
    const resource = RESOURCE_CATALOG[payload.resourceSlug];
    params.append("mode", "payment");
    params.append("metadata[resource_slug]", resource.slug);
    params.append("metadata[label]", `resource:${resource.slug}`);
    params.set("metadata[return_to]", `/resources?highlight=${resource.slug}`);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", resource.currency);
    params.append("line_items[0][price_data][unit_amount]", String(resource.amountCents));
    params.append("line_items[0][price_data][product_data][name]", resource.name);
    params.append("line_items[0][price_data][product_data][description]", resource.description);
  } else {
    return jsonError("Unsupported checkout kind");
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      const stripeMessage =
        typeof result?.error?.message === "string" ? (result.error.message as string) : "Stripe checkout failed";
      console.error("[Payments] Stripe checkout error", {
        status: response.status,
        message: stripeMessage,
        kind,
      });
      return jsonError(stripeMessage, response.status);
    }

    const url = typeof result?.url === "string" ? (result.url as string) : null;
    if (!url) {
      console.error("[Payments] Missing checkout URL in Stripe response", result);
      return jsonError("Stripe did not return a redirect URL", 502);
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[Payments] Unexpected Stripe checkout failure", error);
    return jsonError("Unable to create checkout session", 502);
  }
}
