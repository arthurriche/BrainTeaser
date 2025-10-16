"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Download, Loader2, Sparkles } from "lucide-react";

import { useTranslations } from "@/components/providers/LanguageProvider";
import { RESOURCE_CATALOG, type ResourceSlug, SOCIAL_LINKS } from "@/lib/premium";

type OwnedResources = Partial<Record<ResourceSlug, { downloadUrl: string | null }>>;

type OrdersResponse = {
  resources?: Array<{ slug: ResourceSlug; downloadUrl: string | null }>;
  error?: string;
};

const isResourceSlug = (value: string | null): value is ResourceSlug =>
  Boolean(value && Object.hasOwn(RESOURCE_CATALOG, value as ResourceSlug));

export function ResourcesClient() {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const [ownedResources, setOwnedResources] = useState<OwnedResources>({});
  const [loadingSlug, setLoadingSlug] = useState<ResourceSlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchingOrders, setFetchingOrders] = useState(true);

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFetchingOrders(true);
      try {
        const response = await fetch("/api/resources/orders", { cache: "no-store" });
        const payload = (await response.json()) as OrdersResponse;
        if (cancelled) return;
        if (response.ok && Array.isArray(payload.resources)) {
          const mapped: OwnedResources = {};
          for (const entry of payload.resources) {
            if (entry?.slug && isResourceSlug(entry.slug)) {
              mapped[entry.slug] = { downloadUrl: entry.downloadUrl ?? RESOURCE_CATALOG[entry.slug].downloadPath };
            }
          }
          setOwnedResources(mapped);
        }
      } catch (ordersError) {
        console.error("[Resources] Failed to fetch orders", ordersError);
      } finally {
        if (!cancelled) {
          setFetchingOrders(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurchase = useCallback(
    async (slug: ResourceSlug) => {
      if (ownedResources[slug]?.downloadUrl) {
        const url = ownedResources[slug]?.downloadUrl ?? RESOURCE_CATALOG[slug].downloadPath;
        window.open(url, "_blank", "noopener");
        return;
      }

      setError(null);
      setLoadingSlug(slug);

      try {
        const response = await fetch("/api/payments/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "resource", resourceSlug: slug, locale: "en" }),
        });
        const payload = (await response.json()) as { url?: string | null; error?: string };
        if (!response.ok || !payload?.url) {
          throw new Error(payload?.error && payload.error.length > 0 ? payload.error : t("resources.error"));
        }
        window.location.assign(payload.url);
      } catch (checkoutError) {
        console.error("[Resources] Checkout failed", checkoutError);
        setError(
          checkoutError instanceof Error && checkoutError.message.length > 0
            ? checkoutError.message
            : t("resources.error"),
        );
      } finally {
        setLoadingSlug(null);
      }
    },
    [ownedResources, t],
  );

  const highlightParam = searchParams.get("highlight");
  const highlightSlug = isResourceSlug(highlightParam) ? highlightParam : null;
  const showHighlight = !fetchingOrders && Boolean(highlightSlug);

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-20">
        <header className="space-y-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-100">
            <Sparkles className="h-4 w-4" /> PDF Strategy Pack
          </span>
          <h1 className="text-4xl font-semibold md:text-5xl">{t("resources.title")}</h1>
          <p className="mx-auto max-w-2xl text-sm text-white/70">{t("resources.subtitle")}</p>
        </header>

        {showHighlight && (
          <div className="rounded-2xl border border-emerald-200/30 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
            {t("resources.highlightSuccess")}
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-rose-300/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {Object.values(RESOURCE_CATALOG).map((resource) => {
            const owned = Boolean(ownedResources[resource.slug]);
            const isLoading = loadingSlug === resource.slug;
            const buttonLabel = owned
              ? t("resources.download")
              : isLoading
                ? t("resources.processing")
                : t("resources.purchaseCta", {
                    price: priceFormatter.format(resource.amountCents / 100),
                  });

            return (
              <article
                key={resource.slug}
                className={`group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0px_30px_120px_rgba(255,176,68,0.08)] transition hover:border-amber-200/40 hover:bg-white/10 ${
                  highlightSlug === resource.slug ? "ring-2 ring-amber-300" : ""
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-white">{resource.name}</h2>
                    {owned && (
                      <span className="rounded-full border border-emerald-200/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                        {t("resources.ownedBadge")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-amber-100/80">{resource.headline}</p>
                  <p className="text-sm text-white/70">{resource.description}</p>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                      {t("resources.listTitle")}
                    </p>
                    <ul className="space-y-1 text-sm text-white/75">
                      {resource.benefits.map((benefit, index) => (
                        <li key={`${resource.slug}-benefit-${index}`} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-200" aria-hidden />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      owned
                        ? "border border-emerald-200/50 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                        : "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-slate-900 shadow-lg hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
                    } ${isLoading ? "cursor-wait opacity-80" : ""}`}
                    disabled={isLoading}
                    onClick={() => handlePurchase(resource.slug)}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : owned ? <Download className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    <span>{buttonLabel}</span>
                  </button>
                  {!owned && (
                    <p className="text-xs text-white/60">
                      {priceFormatter.format(resource.amountCents / 100)} · PDF
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/75">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            {t("resources.followTitle")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <a
              href={SOCIAL_LINKS.instagramUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 text-white/80 transition hover:text-white"
            >
              {t("resources.followInstagram", { handle: SOCIAL_LINKS.instagramHandle })}
            </a>
            <a
              href={SOCIAL_LINKS.linkedinUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 text-white/80 transition hover:text-white"
            >
              {t("resources.followLinkedIn")}
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Link
            href="/"
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            ← {t("scoreboard.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
