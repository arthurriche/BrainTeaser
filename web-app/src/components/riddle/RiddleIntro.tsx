"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
interface RiddlePayload {
  id: number;
  question: string;
  imageURL?: string;
  title?: string | null;
  duration?: number | null;
  difficulty?: number | null;
  releaseDate?: string | null;
}

const difficultyLabels: Record<number, string> = {
  1: "Novice",
  2: "Confirmé",
  3: "Expert",
  4: "Grand Maître",
};

const formatDuration = (duration?: number | null) => {
  if (!duration || duration <= 0) return "Pas de limite";
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes} min ${seconds.toString().padStart(2, "0")}`;
};

const todayLabel = () =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const RiddleIntro = () => {
  const router = useRouter();
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
          throw new Error(body || "Impossible de charger l'énigme du jour.");
        }

        const payload = (await response.json()) as RiddlePayload | null;

        if (aborted) return;
        setRiddle(payload);

      } catch (err) {
        if (aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l'énigme du jour."
        );
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    };

    fetchRiddle();

    return () => {
      aborted = true;
    };
  }, []);

  const difficulty = useMemo(() => {
    if (!riddle?.difficulty) return "À découvrir";
    return difficultyLabels[riddle.difficulty] ?? "À découvrir";
  }, [riddle?.difficulty]);

  const releaseDateLabel = useMemo(() => {
    if (!riddle?.releaseDate) return null;
    const date = new Date(riddle.releaseDate);
    if (Number.isNaN(date.getTime())) return null;
    return dateFormatter.format(date);
  }, [riddle?.releaseDate]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/80 px-8 py-6 text-sm text-muted-foreground">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          Chargement de l'énigme du jour…
        </div>
      </div>
    );
  }

  if (error || !riddle) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <div className="h-20 w-20 rounded-full border border-border/70 bg-muted/60 text-4xl text-primary">
          <div className="flex h-full items-center justify-center">⚠️</div>
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Aucune énigme disponible</h2>
          <p>{error ?? "Revenez demain pour une nouvelle énigme."}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {todayLabel()}
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          L'énigme du jour
          <span className="block bg-gradient-to-r from-primary via-emerald-500 to-primary bg-clip-text text-transparent">
            Défie le Maître avec sang-froid
          </span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Prends un instant pour analyser la situation, observe chaque détail et prépare ta meilleure réponse.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="space-y-6 rounded-3xl border border-border bg-white p-10 shadow-xl">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-medium">
              #{riddle.id}
            </span>
            <span className="flex items-center gap-2">
              Difficulté :
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {difficulty}
              </span>
            </span>
          </div>

          <h2 className="text-3xl font-semibold text-foreground">
            {riddle.title ?? "Énigme mystère"}
          </h2>

          <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-slate max-w-none text-lg leading-relaxed text-muted-foreground">
            {riddle.question}
          </ReactMarkdown>
        </article>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-border bg-white p-8 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">Infos express</h3>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>Durée recommandée</dt>
                <dd className="font-medium text-foreground">
                  {formatDuration(riddle.duration ?? 45 * 60)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Progression</dt>
                <dd className="font-medium text-foreground">Enigme n°{riddle.id}</dd>
              </div>
              {releaseDateLabel && (
                <div className="flex items-center justify-between">
                  <dt>Date</dt>
                  <dd className="font-medium text-foreground">{releaseDateLabel}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-muted/60 shadow-inner">
            {riddle.imageURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={riddle.imageURL}
                alt="Illustration de l'énigme"
                className="h-64 w-full object-cover"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Illustration en cours de chargement…
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push("/riddle")}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Commencer l'énigme
          </button>
        </aside>
      </section>
    </div>
  );
};
