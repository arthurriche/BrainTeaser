"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { useTranslations } from "@/components/providers/LanguageProvider";
import { SOCIAL_LINKS } from "@/lib/premium";

export default function PaymentCancelledPage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 pt-24 pb-24 text-center">
        <div className="space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-300" />
          <h1 className="text-3xl font-semibold">{t("payments.cancelledTitle")}</h1>
          <p className="text-sm text-white/70">{t("payments.cancelledSubtitle")}</p>
        </div>

        <Link
          href="/resources"
          className="mx-auto inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          {t("payments.cancelledRetry")}
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
              {t("resources.followInstagram", { handle: SOCIAL_LINKS.instagramHandle })}
            </a>
            <a
              href={SOCIAL_LINKS.linkedinUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 text-white/80 transition hover:text-white"
            >
              {t("resources.followLinkedIn")}
            </a>
          </div>
        </div>

        <Link
          href="/"
          className="mx-auto inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          ← {t("scoreboard.backHome")}
        </Link>
      </div>
    </div>
  );
}
