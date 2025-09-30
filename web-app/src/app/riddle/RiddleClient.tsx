"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TimerPanel } from "@/components/riddle/TimerPanel";
import { ConversationPanel, type ChatMessage } from "@/components/riddle/ConversationPanel";
import { useCountdown } from "@/hooks/useCountdown";

interface RiddlePayload {
  id: number;
  question: string;
  imageURL?: string | null;
  title?: string | null;
  duration?: number | null;
  difficulty?: number | null;
  releaseDate?: string | null;
}

const DIFFICULTY_MAP: Record<number, string> = {
  1: "Novice",
  2: "Confirmé",
  3: "Expert",
  4: "Grand Maître",
};

const DEFAULT_DURATION = 45 * 60;

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function RiddleClient() {
  const [riddle, setRiddle] = useState<RiddlePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdownState, countdownControls] = useCountdown();
  const { start } = countdownControls;

  useEffect(() => {
    let isMounted = true;

    const loadRiddle = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/riddle-today", { cache: "no-store" });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Impossible de charger l'énigme.");
        }

        const payload = (await response.json()) as RiddlePayload | null;
        if (!isMounted) return;

        setRiddle(payload);
        const duration = payload?.duration ?? DEFAULT_DURATION;
        start(duration);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Erreur inattendue");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRiddle();
    return () => {
      isMounted = false;
    };
  }, [start]);

  const difficultyLabel = useMemo(() => {
    if (!riddle?.difficulty) return "À confirmer";
    return DIFFICULTY_MAP[riddle.difficulty] ?? "À confirmer";
  }, [riddle?.difficulty]);

  const releaseDateLabel = useMemo(() => {
    if (!riddle?.releaseDate) return null;
    const date = new Date(riddle.releaseDate);
    if (Number.isNaN(date.getTime())) return null;
    return DATE_FORMATTER.format(date);
  }, [riddle?.releaseDate]);

  const placeholderPersistence = async (_messages: ChatMessage[]) => {
    // TODO: persistance Supabase (table `chats`) avec user + riddleId
    // await supabase.from("chats").upsert(...)
    return Promise.resolve();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        Chargement de l'expérience…
      </div>
    );
  }

  if (error || !riddle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center text-muted-foreground">
        <div className="rounded-full border border-border bg-muted/70 p-6 text-primary">
          <TriangleAlert className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Impossible de charger l'énigme</h1>
          <p>{error ?? "Retente plus tard."}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => window.location.reload()}
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
          Étape de résolution
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          {riddle.title ?? "Énigme mystère"}
          <span className="block bg-gradient-to-r from-primary via-emerald-500 to-primary bg-clip-text text-transparent">
            Le duel avec le Maître
          </span>
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1 font-medium">Enigme n°{riddle.id}</span>
          <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{difficultyLabel}</span>
          {releaseDateLabel && (
            <span className="rounded-full bg-muted px-3 py-1 font-medium">{releaseDateLabel}</span>
          )}
          <span className="rounded-full bg-muted px-3 py-1 font-medium">
            Durée cible : {(riddle.duration ?? DEFAULT_DURATION) / 60} min
          </span>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <main className="space-y-8">
          {riddle.imageURL && (
            <div className="overflow-hidden rounded-3xl border border-border bg-muted/60 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={riddle.imageURL} alt="Illustration de l'énigme" className="w-full object-cover" />
            </div>
          )}

          <article className="space-y-6 rounded-3xl border border-border bg-white p-10 text-lg leading-relaxed text-muted-foreground shadow-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Enoncé</p>
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-slate max-w-none text-foreground">
              {riddle.question}
            </ReactMarkdown>
          </article>

          <section className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-6 text-sm text-primary">
            <p className="font-semibold">À venir :</p>
            <ul className="mt-2 space-y-1">
              <li>• Indices progressifs (stockés dans Supabase, révélés selon le timer).</li>
              <li>• Validation de ta réponse et calcul du score final.</li>
              <li>• Synchronisation complète des échanges avec la table `chats`.</li>
            </ul>
          </section>
        </main>

        <aside className="flex flex-col gap-6">
          <TimerPanel
            state={countdownState}
            controls={countdownControls}
            autoStartSeconds={riddle.duration ?? DEFAULT_DURATION}
          />

          <ConversationPanel
            initialMessages={[]}
            onPersist={placeholderPersistence}
          />
        </aside>
      </div>
    </div>
  );
}
