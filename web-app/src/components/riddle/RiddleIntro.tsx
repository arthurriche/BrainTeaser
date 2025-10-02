
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { useTranslations } from "@/components/providers/LanguageProvider";

interface RiddlePayload {
  id: number;
  question: string;
  imageURL?: string;
  title?: string | null;
  duration?: number | null;
  difficulty?: number | null;
  releaseDate?: string | null;
}

const DIFFICULTY_LABELS: Record<number, { en: string; fr: string }> = {
  1: { en: "Novice", fr: "Novice" },
  2: { en: "Skilled", fr: "Confirmé" },
  3: { en: "Expert", fr: "Expert" },
  4: { en: "Grandmaster", fr: "Grand Maître" },
};

const formatDuration = (duration: number | null | undefined, language: string) => {
  if (!duration || duration <= 0) return language === "fr" ? "Pas de limite" : "No limit";
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return language === "fr"
    ? `${minutes} min ${seconds.toString().padStart(2, "0")}`
    : `${minutes} min ${seconds.toString().padStart(2, "0")}s`;
};

const getDateFormatter = (language: string) =>
  new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const RiddleIntro = () => {
  const router = useRouter();
  const { t, language } = useTranslations();
  const [riddle, setRiddle] = useState<RiddlePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    const fetchRiddle = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/riddle-today", { cache: "no-store" });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Unable to load today's riddle.");
        }

        const payload = (await response.json()) as RiddlePayload | null;
        if (aborted) return;
        setRiddle(payload);
      } catch (err) {
        if (aborted) return;
        setError(err instanceof Error ? err.message : "Unable to load today's riddle.");
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    };

    void fetchRiddle();

    return () => {
      aborted = true;
    };
  }, []);

  const difficulty = useMemo(() => {
    if (!riddle?.difficulty) return language === "fr" ? "À découvrir" : "To be discovered";
    return DIFFICULTY_LABELS[riddle.difficulty]?.[language] ?? (language === "fr" ? "À découvrir" : "To be discovered");
  }, [riddle?.difficulty, language]);

  const releaseDateLabel = useMemo(() => {
    if (!riddle?.releaseDate) return null;
    const date = new Date(riddle.releaseDate);
    if (Number.isNaN(date.getTime())) return null;
    return getDateFormatter(language).format(date);
  }, [riddle?.releaseDate, language]);

  const renderLoading = () => (
    <div className="relative min-h-screen text-white">
      <TopBar />
      <div className="mx-auto mt-32 flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-white/70" />
        <p className="text-sm text-white/60">{t("intro.loading")}</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="relative min-h-screen text-white">
      <TopBar />
      <div className="mx-auto mt-32 flex max-w-4xl flex-col items-center gap-6 px-6 text-center">
        <h2 className="text-3xl font-semibold text-white">{t("intro.emptyTitle")}</h2>
        <p className="text-sm text-white/70">{error ?? t("intro.emptyDescription")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-white/80 px-6 py-2 text-sm font-semibold text-background transition hover:bg-white"
        >
          {t("intro.retry")}
        </button>
      </div>
    </div>
  );

  if (loading) return renderLoading();
  if (error) return renderError();

  return (
    <div className="relative min-h-screen pb-24 text-white">
      <TopBar />
      <main className="mx-auto mt-20 flex w-full max-w-6xl flex-col gap-12 px-6">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="elevated-card space-y-8 p-10 text-left text-white/80">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.35em] text-white/50">
              <span>{t("intro.badge")}</span>
              <span>{difficulty}</span>
            </div>
            <div className="glow-divider" />
            <header className="space-y-4">
              <h1 className="text-4xl font-semibold text-white">
                {riddle?.title ?? (language === "fr" ? "Énigme mystère" : "Mystery riddle")}
              </h1>
              <p className="text-lg text-white/70">{t("intro.heroHighlight")}</p>
              <p className="text-sm text-white/60">{t("intro.heroDescription")}</p>
            </header>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <dl className="grid gap-3">
                <div className="flex items-center justify-between">
                  <dt>{t("intro.info.durationLabel")}</dt>
                  <dd className="font-semibold text-white/85">{formatDuration(riddle?.duration ?? 45 * 60, language)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>{t("intro.info.progressionLabel")}</dt>
                  <dd className="font-semibold text-white/85">#{riddle?.id ?? 0}</dd>
                </div>
                {releaseDateLabel && (
                  <div className="flex items-center justify-between">
                    <dt>{t("intro.info.dateLabel")}</dt>
                    <dd className="font-semibold text-white/85">{releaseDateLabel}</dd>
                  </div>
                )}
              </dl>
            </div>
            <button
              type="button"
              onClick={() => router.push("/riddle")}
              className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
            >
              {t("intro.primaryCta")}
            </button>
          </article>

          <div className="flex flex-col gap-6">
            <div className="glass-panel flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center text-white/80">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-300/20 text-amber-100">
                <Lock className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-white">{t("intro.lockedTitle")}</p>
              <p className="max-w-sm text-sm text-white/70">{t("intro.lockedDescription")}</p>
            </div>
            <div className="glass-panel space-y-4 p-8 text-left text-white/80">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-100/70">
                {language === "fr" ? "Avant de commencer" : "Before you start"}
              </p>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="rounded-2xl border border-amber-200/20 bg-white/5 px-4 py-3">
                  {language === "fr"
                    ? "Installe-toi dans un endroit calme. Tu auras 45 minutes environ."
                    : "Find a quiet spot. Expect about 45 minutes."}
                </li>
                <li className="rounded-2xl border border-amber-200/20 bg-white/5 px-4 py-3">
                  {language === "fr"
                    ? "Clique sur le bouton quand tu es prêt : le chrono démarre tout de suite."
                    : "Press the button when ready—the timer starts immediately."}
                </li>
                <li className="rounded-2xl border border-amber-200/20 bg-white/5 px-4 py-3">
                  {language === "fr"
                    ? "Tu pourras demander des indices mais ils font baisser le score."
                    : "Hints are available, but each one lowers your score."}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
