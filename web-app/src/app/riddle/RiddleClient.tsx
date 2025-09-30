"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TimerPanel } from "@/components/riddle/TimerPanel";
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
  rankingPercent: number;
  beatenPlayers: number;
  totalPlayers: number;
}

const DIFFICULTY_MAP: Record<number, string> = {
  1: "Novice",
  2: "Confirmé",
  3: "Expert",
  4: "Grand Maître",
};

const DEFAULT_DURATION = 45 * 60;
const MAX_ATTEMPTS = 3;

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const mergeScoreData = (
  base: ScoreResult | null,
  overrides: Partial<ScoreResult> & { score: number; rankingPercent: number; beatenPlayers: number; totalPlayers: number },
): ScoreResult => ({
  correct: overrides.correct ?? base?.correct ?? false,
  score: overrides.score,
  feedback:
    overrides.feedback ??
    base?.feedback ??
    "Ta tentative est enregistrée. Analyse les indices pour améliorer ta prochaine réponse.",
  hintsUsed: overrides.hintsUsed ?? base?.hintsUsed ?? 0,
  timeSpent: overrides.timeSpent ?? base?.timeSpent ?? 0,
  userMessages: overrides.userMessages ?? base?.userMessages ?? 0,
  timeRemaining: overrides.timeRemaining ?? base?.timeRemaining ?? 0,
  rankingPercent: overrides.rankingPercent,
  beatenPlayers: overrides.beatenPlayers,
  totalPlayers: overrides.totalPlayers,
});

export function RiddleClient() {
  const [riddle, setRiddle] = useState<RiddlePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scoreboardError, setScoreboardError] = useState<string | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);

  const [submittingAnswer, setSubmittingAnswer] = useState(false);

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
      setRevealedHints([]);
      setUserAnswer("");
      setAttemptsUsed(0);
      setScoreResult(null);
      setShowScoreboard(false);
      setScoreboardError(null);
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
    return [riddle.hint1, riddle.hint2, riddle.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );
  }, [riddle]);

  const hasMoreHints = revealedHints.length < hints.length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);

  const handleRevealHint = useCallback(() => {
    if (!hasMoreHints) return;
    setRevealedHints((prev) => [...prev, prev.length]);
  }, [hasMoreHints]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!riddle || !userAnswer.trim()) return;
    if (attemptsUsed >= MAX_ATTEMPTS || submittingAnswer) return;

    setSubmittingAnswer(true);
    setShowScoreboard(false);
    setScoreboardError(null);

    try {
      const response = await fetch("/api/riddle-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riddleId: riddle.id,
          answer: userAnswer,
          totalDuration: countdownState.totalDuration,
          timeRemaining: countdownState.timeRemaining,
          hintsUsed: revealedHints.length,
          userMessages: attemptsUsed + 1,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Soumission impossible");
      }

      const result = (await response.json()) as ScoreResult;
      setAttemptsUsed((prev) => prev + 1);
      setScoreResult(result);

      if (result.correct || attemptsUsed + 1 >= MAX_ATTEMPTS) {
        pause();
        setShowScoreboard(true);
      }
    } catch (err) {
      setScoreboardError(err instanceof Error ? err.message : "Soumission impossible");
    } finally {
      setSubmittingAnswer(false);
    }
  }, [riddle, userAnswer, attemptsUsed, submittingAnswer, countdownState.totalDuration, countdownState.timeRemaining, revealedHints.length, pause]);

  const fetchScoreboard = useCallback(async () => {
    if (!riddle) return;
    setScoreboardLoading(true);
    setScoreboardError(null);
    try {
      const response = await fetch(`/api/riddle-scoreboard?riddleId=${riddle.id}`, { cache: "no-store" });
      if (response.status === 401) {
        setScoreboardError('Connecte-toi pour accéder au classement.');
        setShowScoreboard(true);
        setScoreboardLoading(false);
        return;
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Impossible de récupérer le classement");
      }
      const data = await response.json();
      if (data?.hasScore) {
        const merged = mergeScoreData(scoreResult, {
          score: data.score ?? 0,
          rankingPercent: data.rankingPercent ?? 0,
          beatenPlayers: data.beatenPlayers ?? 0,
          totalPlayers: data.totalPlayers ?? 0,
          hintsUsed: scoreResult?.hintsUsed ?? revealedHints.length,
          timeSpent: data.duration ?? countdownState.totalDuration,
          userMessages: data.msgCount ?? attemptsUsed,
          timeRemaining: scoreResult?.timeRemaining ?? 0,
        });
        setScoreResult(merged);
        setShowScoreboard(true);
      } else {
        setScoreboardError("Aucun score enregistré pour cette énigme.");
        setShowScoreboard(true);
      }
    } catch (err) {
      setScoreboardError(err instanceof Error ? err.message : "Impossible de récupérer le classement");
      setShowScoreboard(true);
    } finally {
      setScoreboardLoading(false);
    }
  }, [riddle, scoreResult, revealedHints.length, countdownState.totalDuration, attemptsUsed]);

  useEffect(() => {
    if (!showScoreboard && countdownState.timeRemaining === 0) {
      void fetchScoreboard();
      pause();
    }
  }, [countdownState.timeRemaining, fetchScoreboard, showScoreboard, pause]);

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

  const scoreboardShouldDisplay = showScoreboard || scoreResult?.correct;

  if (scoreboardShouldDisplay) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Classement</p>
          <h1 className="text-4xl font-semibold text-foreground">Résultats de l’énigme n°{riddle.id}</h1>
        </div>

        <div className="w-full space-y-4 rounded-3xl border border-border bg-white p-8 text-muted-foreground shadow-xl">
          <p className="text-lg font-semibold text-foreground">Score : {scoreResult?.score ?? 0}</p>
          <p>{scoreResult?.feedback ?? "Ton score est enregistré. Reviens demain pour une nouvelle énigme."}</p>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Temps utilisé</p>
              <p className="text-lg font-medium text-foreground">{formatSeconds(scoreResult?.timeSpent ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tentatives restantes</p>
              <p className="text-lg font-medium text-foreground">{Math.max(0, MAX_ATTEMPTS - attemptsUsed)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Indices utilisés</p>
              <p className="text-lg font-medium text-foreground">{scoreResult?.hintsUsed ?? revealedHints.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Participants battus</p>
              <p className="text-lg font-medium text-foreground">
                {scoreResult?.totalPlayers
                  ? `${scoreResult.beatenPlayers}/${scoreResult.totalPlayers} (${scoreResult.rankingPercent} %)`
                  : "Insuffisant pour établir un classement"}
              </p>
            </div>
          </div>

          {scoreboardError && (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {scoreboardError}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
            onClick={() => window.alert("Apple Pay n’est pas encore connecté. Merci de votre soutien !")}
          >
            Soutenir via Apple Pay (0,30 €)
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-5 py-2 font-medium text-foreground transition hover:bg-muted"
            onClick={() => window.location.assign("/")}
          >
            Retourner à l’accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <TimerPanel state={countdownState} />

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

      <div className="space-y-8">
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

        <section className="space-y-4 rounded-3xl border border-border bg-white p-8 text-muted-foreground shadow-xl">
          <h3 className="text-lg font-semibold text-foreground">Ta réponse</h3>
          <textarea
            className="min-h-[120px] w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Formule ici ta solution complète."
            value={userAnswer}
            onChange={(event) => setUserAnswer(event.target.value)}
            disabled={submittingAnswer || attemptsUsed >= MAX_ATTEMPTS}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Essais restants : {attemptsLeft}</span>
            <span>Temps restant : {formatSeconds(countdownState.timeRemaining)}</span>
            <span>Indices utilisés : {revealedHints.length}</span>
          </div>
          {scoreResult && !scoreResult.correct && attemptsUsed > 0 && (
            <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {scoreResult.feedback}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              onClick={handleSubmitAnswer}
              disabled={submittingAnswer || attemptsUsed >= MAX_ATTEMPTS}
            >
              {submittingAnswer ? "Validation…" : "Valider ma réponse"}
            </button>
            <button
              type="button"
              className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={fetchScoreboard}
              disabled={scoreboardLoading}
            >
              {scoreboardLoading ? "Calcul en cours…" : "Voir mon classement"}
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-border bg-white p-8 text-muted-foreground shadow-xl">
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
            {!hasMoreHints && hints.length > 0 && revealedHints.length > 0 && (
              <p className="text-xs text-muted-foreground">Tous les indices ont été révélés.</p>
            )}
            {hints.length === 0 && <p>Aucun indice n’est disponible pour cette énigme.</p>}
          </div>
        </section>

        {scoreboardError && !showScoreboard && (
          <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
            {scoreboardError}
          </p>
        )}
      </div>
    </div>
  );
}
