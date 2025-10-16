"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { useTranslations } from "@/components/providers/LanguageProvider";
import { SOCIAL_LINKS } from "@/lib/premium";

type ConfirmPayload =
  | {
      success: true;
      kind: "single_riddle";
      unlockedRiddleId?: number;
      returnTo: string;
      amountCents?: number;
      currency?: string;
    }
  | {
      success: true;
      kind: "subscription";
      validUntil?: string | null;
      returnTo: string;
      amountCents?: number;
      currency?: string;
    }
  | {
      success: true;
      kind: "resource";
      resourceSlug?: string;
      downloadUrl?: string | null;
      returnTo: string;
      amountCents?: number;
      currency?: string;
    }
  | {
      error: string;
    };

const getCurrencyFormatter = (locale: "en" | "fr") =>
  new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

export default function PaymentSuccessPage() {
  const { t, language } = useTranslations();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string>("/riddle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceFormatter = useMemo(() => getCurrencyFormatter(language), [language]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      setError(t("payments.errorMissing"));
      return;
    }

    let cancelled = false;

    const confirm = async () => {
      setStatus("loading");
      try {
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await response.json()) as ConfirmPayload;

        if (cancelled) return;

        if (!response.ok || !payload || "error" in payload) {
          const errorMessage = "error" in payload && payload.error ? payload.error : t("payments.errorGeneric");
          setError(errorMessage);
          setStatus("error");
          return;
        }

        const nextReturn = payload.returnTo ?? "/riddle";
        setReturnTo(nextReturn.startsWith("/") ? nextReturn : `/${nextReturn}`);

        if (payload.kind === "single_riddle") {
          const price = payload.amountCents ? priceFormatter.format(payload.amountCents / 100) : priceFormatter.format(1);
          setMessage(t("payments.successSingle", { price }));
        } else if (payload.kind === "subscription") {
          const dateLabel = payload.validUntil
            ? new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(payload.validUntil))
            : null;
          const price = payload.amountCents ? priceFormatter.format(payload.amountCents / 100) : priceFormatter.format(9.9);
          setMessage(
            t("payments.successSubscription", {
              price,
              date: dateLabel ?? t("payments.successSubscriptionNoDate"),
            }),
          );
        } else if (payload.kind === "resource") {
          const price = payload.amountCents ? priceFormatter.format(payload.amountCents / 100) : priceFormatter.format(15);
          setMessage(t("payments.successResource", { price }));
          setDownloadUrl(payload.downloadUrl ?? null);
        }

        setStatus("success");
      } catch (confirmError) {
        if (cancelled) return;
        console.error("[Payments] Confirmation failed", confirmError);
        setError(t("payments.errorGeneric"));
        setStatus("error");
      }
    };

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [language, priceFormatter, searchParams, t]);

  const socialInstagramLabel = t("resources.followInstagram", { handle: SOCIAL_LINKS.instagramHandle });
  const socialLinkedinLabel = t("resources.followLinkedIn");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 pt-24 pb-24 text-center">
        <div className="space-y-4">
          {status === "loading" && <Loader2 className="mx-auto h-12 w-12 animate-spin text-amber-200" />}
          {status === "success" && <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />}
          {status === "error" && <AlertTriangle className="mx-auto h-12 w-12 text-rose-300" />}
          <h1 className="text-3xl font-semibold">
            {status === "success"
              ? t("payments.successTitle")
              : status === "loading"
                ? t("payments.loadingTitle")
                : t("payments.errorTitle")}
          </h1>
          <p className="text-sm text-white/70">
            {status === "success"
              ? message ?? t("payments.successSubtitle")
              : status === "loading"
                ? t("payments.loadingSubtitle")
                : error ?? t("payments.errorGeneric")}
          </p>
        </div>

        {status === "success" && downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
          >
            {t("payments.downloadResource")}
          </a>
        )}

        <Link
          href={returnTo}
          className="mx-auto inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          {t("payments.returnButton")}
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/75">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            {t("resources.followTitle")}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={SOCIAL_LINKS.instagramUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 text-white/80 transition hover:text-white"
            >
              {socialInstagramLabel}
            </a>
            <a
              href={SOCIAL_LINKS.linkedinUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 text-white/80 transition hover:text-white"
            >
              {socialLinkedinLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
