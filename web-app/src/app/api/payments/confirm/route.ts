import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { PREMIUM_PRICES, RESOURCE_CATALOG, type ResourceSlug } from "@/lib/premium";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();

type ConfirmPayload = {
  sessionId?: string;
};

type StripeCheckoutMetadata = {
  user_id?: string;
  kind?: "single_riddle" | "subscription" | "resource";
  riddle_id?: string;
  resource_slug?: string;
  return_to?: string;
};

type StripeCheckoutSession = {
  metadata?: Record<string, unknown>;
  payment_status?: string | null;
  status?: string | null;
  subscription?:
    | {
        current_period_end?: number | null;
      }
    | null
    | string;
  error?: {
    message?: string;
  };
  [key: string]: unknown;
};

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const getSafeMetadata = (value: unknown): StripeCheckoutMetadata => {
  if (!value || typeof value !== "object") return {};
  const entries = value as Record<string, unknown>;
  return {
    user_id: typeof entries.user_id === "string" ? entries.user_id : undefined,
    kind: typeof entries.kind === "string" ? (entries.kind as StripeCheckoutMetadata["kind"]) : undefined,
    riddle_id: typeof entries.riddle_id === "string" ? entries.riddle_id : undefined,
    resource_slug: typeof entries.resource_slug === "string" ? entries.resource_slug : undefined,
    return_to: typeof entries.return_to === "string" ? entries.return_to : undefined,
  };
};

const isResourceSlug = (value: string): value is ResourceSlug =>
  Object.hasOwn(RESOURCE_CATALOG, value as ResourceSlug);

const getSubscriptionValidity = (checkoutSession: StripeCheckoutSession): string => {
  const subscription = checkoutSession.subscription;
  if (subscription && typeof subscription === "object" && "current_period_end" in subscription) {
    const periodEnd = (subscription as { current_period_end?: number }).current_period_end;
    if (typeof periodEnd === "number" && Number.isFinite(periodEnd)) {
      return new Date(periodEnd * 1000).toISOString();
    }
  }
  // Fallback: 31 days of access
  const fallback = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  return fallback.toISOString();
};

export async function POST(request: Request) {
  if (!STRIPE_SECRET_KEY) {
    return jsonError("Stripe is not configured", 500);
  }

  let body: ConfirmPayload;
  try {
    body = (await request.json()) as ConfirmPayload;
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return jsonError("sessionId is required");
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return jsonError("Authentication required", 401);
  }

  let stripeSession: StripeCheckoutSession;
  try {
    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription`, {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    const parsed = (await stripeResponse.json()) as StripeCheckoutSession | { error?: { message?: string } };
    if (!stripeResponse.ok) {
      const stripeMessage =
        typeof parsed?.error?.message === "string" ? (parsed.error.message as string) : "Stripe checkout lookup failed";
      console.error("[Payments] Stripe lookup failed", { sessionId, status: stripeResponse.status, stripeMessage });
      return jsonError(stripeMessage, stripeResponse.status);
    }
    stripeSession = parsed as StripeCheckoutSession;
  } catch (error) {
    console.error("[Payments] Stripe lookup threw", error);
    return jsonError("Unable to verify payment", 502);
  }

  if (!stripeSession || typeof stripeSession !== "object") {
    return jsonError("Stripe session payload invalid", 502);
  }

  const metadata = getSafeMetadata(stripeSession.metadata);
  if (!metadata.kind) {
    return jsonError("Checkout metadata is missing the kind", 400);
  }

  if (!metadata.user_id || metadata.user_id !== session.user.id) {
    return jsonError("Checkout session does not belong to the current user", 403);
  }

  const paymentStatus = typeof stripeSession.payment_status === "string" ? stripeSession.payment_status : null;
  const status = typeof stripeSession.status === "string" ? stripeSession.status : null;
  if (paymentStatus !== "paid" && status !== "complete") {
    return jsonError("Payment not completed yet", 409);
  }

  const nowIso = new Date().toISOString();
  const returnTo = metadata.return_to ?? "/riddle";

  if (metadata.kind === "single_riddle") {
    const riddleId = metadata.riddle_id ? Number.parseInt(metadata.riddle_id, 10) : Number.NaN;
    if (!Number.isFinite(riddleId) || Number.isNaN(riddleId) || riddleId <= 0) {
      return jsonError("Invalid riddle metadata attached to the checkout session", 400);
    }

    const existing = await supabase
      .from("premium_access")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("access_type", "single")
      .eq("riddle_id", riddleId)
      .maybeSingle();

    if (existing.error) {
      console.error("[Payments] Failed to lookup premium access", existing.error);
      return jsonError("Unable to grant access", 500);
    }

    if (existing.data?.id) {
      const update = await supabase
        .from("premium_access")
        .update({
          stripe_session_id: sessionId,
          created_at: nowIso,
        })
        .eq("id", existing.data.id);
      if (update.error) {
        console.error("[Payments] Failed to update premium access", update.error);
        return jsonError("Unable to grant access", 500);
      }
    } else {
      const insert = await supabase.from("premium_access").insert({
        user_id: session.user.id,
        access_type: "single",
        riddle_id: riddleId,
        valid_until: null,
        stripe_session_id: sessionId,
        created_at: nowIso,
      });
      if (insert.error) {
        console.error("[Payments] Failed to insert premium access", insert.error);
        return jsonError("Unable to grant access", 500);
      }
    }

    return NextResponse.json({
      success: true,
      kind: metadata.kind,
      unlockedRiddleId: riddleId,
      returnTo,
      amountCents: PREMIUM_PRICES.single.amountCents,
      currency: PREMIUM_PRICES.single.currency,
    });
  }

  if (metadata.kind === "subscription") {
    const validUntil = getSubscriptionValidity(stripeSession);
    const existing = await supabase
      .from("premium_access")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("access_type", "subscription")
      .maybeSingle();

    if (existing.error) {
      console.error("[Payments] Failed to lookup subscription access", existing.error);
      return jsonError("Unable to grant subscription access", 500);
    }

    if (existing.data?.id) {
      const update = await supabase
        .from("premium_access")
        .update({
          stripe_session_id: sessionId,
          valid_until: validUntil,
          created_at: nowIso,
        })
        .eq("id", existing.data.id);
      if (update.error) {
        console.error("[Payments] Failed to update subscription access", update.error);
        return jsonError("Unable to grant subscription access", 500);
      }
    } else {
      const insert = await supabase.from("premium_access").insert({
        user_id: session.user.id,
        access_type: "subscription",
        riddle_id: null,
        valid_until,
        stripe_session_id: sessionId,
        created_at: nowIso,
      });
      if (insert.error) {
        console.error("[Payments] Failed to insert subscription access", insert.error);
        return jsonError("Unable to grant subscription access", 500);
      }
    }

    return NextResponse.json({
      success: true,
      kind: metadata.kind,
      validUntil,
      returnTo,
      amountCents: PREMIUM_PRICES.subscription.amountCents,
      currency: PREMIUM_PRICES.subscription.currency,
    });
  }

  if (metadata.kind === "resource") {
    if (!metadata.resource_slug || !isResourceSlug(metadata.resource_slug)) {
      return jsonError("Invalid resource metadata attached to the checkout session", 400);
    }

    const resource = RESOURCE_CATALOG[metadata.resource_slug];
    const existing = await supabase
      .from("resource_orders")
      .select("id, status")
      .eq("user_id", session.user.id)
      .eq("resource_slug", resource.slug)
      .maybeSingle();

    if (existing.error) {
      console.error("[Payments] Failed to lookup resource order", existing.error);
      return jsonError("Unable to grant resource access", 500);
    }

    if (existing.data?.id) {
      const update = await supabase
        .from("resource_orders")
        .update({
          stripe_session_id: sessionId,
          status: "paid",
          download_url: resource.downloadPath,
          fulfilled_at: nowIso,
        })
        .eq("id", existing.data.id);
      if (update.error) {
        console.error("[Payments] Failed to update resource order", update.error);
        return jsonError("Unable to grant resource access", 500);
      }
    } else {
      const insert = await supabase.from("resource_orders").insert({
        user_id: session.user.id,
        resource_slug: resource.slug,
        stripe_session_id: sessionId,
        status: "paid",
        download_url: resource.downloadPath,
        created_at: nowIso,
        fulfilled_at: nowIso,
      });
      if (insert.error) {
        console.error("[Payments] Failed to insert resource order", insert.error);
        return jsonError("Unable to grant resource access", 500);
      }
    }

    return NextResponse.json({
      success: true,
      kind: metadata.kind,
      resourceSlug: resource.slug,
      downloadUrl: resource.downloadPath,
      returnTo,
      amountCents: resource.amountCents,
      currency: resource.currency,
    });
  }

  return jsonError("Unsupported checkout kind", 400);
}
