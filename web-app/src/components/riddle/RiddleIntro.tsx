
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";

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
              className="rounded-full bg-white/80 px-6 py-3 text-base font-semibold text-background transition hover:bg-white"
            >
              {t("intro.primaryCta")}
            </button>
          </article>

          <div className="flex flex-col gap-6">
            <div className="glass-panel flex-1 overflow-hidden">
              {riddle?.imageURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={riddle.imageURL}
                  alt={riddle?.title ?? "Riddle illustration"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-white/60">
                  {t("intro.imagePlaceholder")}
                </div>
              )}
            </div>
            <div className="glass-panel max-h-[360px] overflow-y-auto p-8 text-white/80">
              <p className="muted-label">{language === "fr" ? "Énoncé" : "Prompt"}</p>
              <div className="mt-4 prose prose-invert max-w-none text-base leading-relaxed text-white/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{riddle?.question ?? ""}</ReactMarkdown>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
