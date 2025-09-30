"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

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
  hint1?: string | null;
  hint2?: string | null;
  hint3?: string | null;
}

interface ScoreResult {
  correct: boolean;
  score: number;
  feedback: string;
  hintsUsed: number;
  timeSpent: number;
  userMessages: number;
  timeRemaining: number;
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

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const mapStoredMessages = (raw: unknown[]): ChatMessage[] =>
  Array.isArray(raw)
    ? raw.map((entry, index) => {
        const candidate = entry as {
          id?: string;
          text?: string;
          author?: string;
          created_at?: string;
        };

        return {
          id: candidate.id ?? `msg-server-${index}`,
          text: String(candidate.text ?? ""),
          author: candidate.author === "user" ? "user" : "master",
          createdAt: candidate.created_at ? new Date(candidate.created_at).getTime() : Date.now(),
        };
      })
    : [];

const formatSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export function RiddleClient() {
  const [riddle, setRiddle] = useState<RiddlePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMasterTyping, setIsMasterTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  const [countdownState, countdownControls] = useCountdown();
  const { start, pause } = countdownControls;

  const loadRiddle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/riddle-today", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Impossible de charger l’énigme.");
      }
      const payload = (await response.json()) as RiddlePayload | null;
      if (!payload) {
        throw new Error("Aucune énigme disponible");
      }
      setRiddle(payload);
      start(payload.duration ?? DEFAULT_DURATION);

      const conversationResponse = await fetch(
        `/api/master-chat?riddleId=${payload.id}`,
        { cache: "no-store" },
      );
      if (conversationResponse.ok) {
        const data = await conversationResponse.json();
        setMessages(mapStoredMessages(data?.messages ?? []));
      } else {
        setMessages([
          {
            id: createMessageId(),
            author: "master",
            text: "Bienvenue. Quelle est ta première intuition ?",
            createdAt: Date.now(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, [start]);

  useEffect(() => {
    void loadRiddle();
  }, [loadRiddle]);

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

  const hints = useMemo(() => {
    if (!riddle) return [] as string[];
    const list = [riddle.hint1, riddle.hint2, riddle.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );
    return list;
  }, [riddle]);

  const hasMoreHints = revealedHints.length < hints.length;

  const handleRevealHint = useCallback(async () => {
    if (!riddle || !hasMoreHints) return;
    const nextIndex = revealedHints.length;
    const hintText = hints[nextIndex];
    const hintMessage: ChatMessage = {
      id: createMessageId(),
      author: "master",
      text: `Indice ${nextIndex + 1} : ${hintText}`,
      createdAt: Date.now(),
    };

    setRevealedHints((prev) => [...prev, nextIndex]);
    setMessages((prev) => [...prev, hintMessage]);

    try {
      const response = await fetch("/api/master-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riddleId: riddle.id,
          masterMessage: hintMessage.text,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(mapStoredMessages(data?.messages ?? []));
      }
    } catch (error) {
      console.error(error);
    }
  }, [riddle, hasMoreHints, revealedHints.length, hints]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!riddle) return;
      const optimisticMessage: ChatMessage = {
        id: createMessageId(),
        author: "user",
        text: content,
        createdAt: Date.now(),
      };

      setChatError(null);
      setIsSendingMessage(true);
      setIsMasterTyping(true);
      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const response = await fetch("/api/master-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riddleId: riddle.id,
            message: content,
            riddleContext: {
              question: riddle.question,
              title: riddle.title,
              hints,
            },
            revealedHints: revealedHints.map((index) => hints[index]),
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Conversation indisponible");
        }

        const data = await response.json();
        setMessages(mapStoredMessages(data?.messages ?? []));
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Erreur de conversation");
        setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      } finally {
        setIsSendingMessage(false);
        setIsMasterTyping(false);
      }
    },
    [riddle, revealedHints, hints],
  );

  const totalDuration = countdownState.totalDuration || riddle?.duration || DEFAULT_DURATION;
  const hintsUsed = revealedHints.length;
  const userMessagesCount = messages.filter((message) => message.author === "user").length;
  const conversationLocked = Boolean(scoreResult?.correct);

  const handleSubmitAnswer = useCallback(async () => {
    if (!riddle || !userAnswer.trim() || submittingAnswer) return;

    setSubmittingAnswer(true);
    setChatError(null);

    try {
      const response = await fetch("/api/riddle-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riddleId: riddle.id,
          answer: userAnswer,
          totalDuration,
          timeRemaining: countdownState.timeRemaining,
          hintsUsed,
          userMessages: userMessagesCount,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Soumission impossible");
      }

      const result = (await response.json()) as ScoreResult;
      setScoreResult(result);
      if (result.correct) {
        pause();
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Soumission impossible");
    } finally {
      setSubmittingAnswer(false);
    }
  }, [riddle, userAnswer, submittingAnswer, totalDuration, countdownState.timeRemaining, hintsUsed, userMessagesCount, pause]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        Chargement de l’expérience…
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
          <h1 className="text-2xl font-semibold text-foreground">Impossible de charger l’énigme</h1>
          <p>{error ?? "Retente plus tard."}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          onClick={loadRiddle}
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
              <img src={riddle.imageURL} alt="Illustration de l’énigme" className="w-full object-cover" />
            </div>
          )}

          <article className="space-y-6 rounded-3xl border border-border bg-white p-10 text-lg leading-relaxed text-muted-foreground shadow-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Enoncé</p>
            <div className="prose prose-slate max-w-none text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{riddle.question}</ReactMarkdown>
            </div>
          </article>

          <section className="space-y-4 rounded-3xl border border-border bg-white p-8 text-sm text-muted-foreground shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Indices</h3>
              {hasMoreHints && (
                <button
                  type="button"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                  onClick={handleRevealHint}
                >
                  Révéler l’indice {revealedHints.length + 1}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {revealedHints.length === 0 && <p>Utilise les indices avec parcimonie : chaque indice réduit ton score final.</p>}
              {revealedHints.map((index) => (
                <div
                  key={`hint-${index}`}
                  className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-primary"
                >
                  <p className="text-sm font-semibold">Indice {index + 1}</p>
                  <div className="prose prose-primary mt-2 max-w-none text-primary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{hints[index]}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {!hasMoreHints && hints.length > 0 && (
                <p className="text-xs text-muted-foreground">Tous les indices ont été révélés.</p>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-border bg-white p-8 text-muted-foreground shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Ta réponse finale</h3>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Formule ici ta solution complète."
              value={userAnswer}
              onChange={(event) => setUserAnswer(event.target.value)}
              disabled={submittingAnswer || Boolean(scoreResult?.correct)}
            />
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span>Indices utilisés : {hintsUsed}</span>
              <span>Messages envoyés : {userMessagesCount}</span>
              <span>Temps restant : {formatSeconds(countdownState.timeRemaining)}</span>
            </div>
            {scoreResult && (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  scoreResult.correct
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                    : "border-amber-500/50 bg-amber-500/10 text-amber-700",
                )}
              >
                <p className="font-semibold">Score : {scoreResult.score}</p>
                <p>{scoreResult.feedback}</p>
                <p className="mt-2 text-xs">Temps écoulé : {formatSeconds(scoreResult.timeSpent)} – Indices : {scoreResult.hintsUsed}</p>
              </div>
            )}
            <button
              type="button"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              onClick={handleSubmitAnswer}
              disabled={submittingAnswer || Boolean(scoreResult?.correct)}
            >
              {submittingAnswer ? "Validation..." : "Valider ma réponse"}
            </button>
          </section>
        </main>

        <aside className="flex flex-col gap-6">
          <TimerPanel
            state={countdownState}
            controls={countdownControls}
            autoStartSeconds={riddle.duration ?? DEFAULT_DURATION}
          />

          <ConversationPanel
            messages={messages}
            isMasterTyping={isMasterTyping}
            isSending={isSendingMessage}
            onSend={handleSendMessage}
            onRequestHint={hasMoreHints ? handleRevealHint : undefined}
            hasMoreHints={hasMoreHints}
            disableInput={conversationLocked}
          />

          {chatError && (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {chatError}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
