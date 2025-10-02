
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import Confetti from "react-confetti";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TimerPanel } from "@/components/riddle/TimerPanel";
import { useCountdown } from "@/hooks/useCountdown";
import { TopBar } from "@/components/layout/TopBar";
import { useTranslations } from "@/components/providers/LanguageProvider";

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
  hints?: string[];
  resultImageURL?: string | null;
  judgeConfidence?: number | null;
  judgeMissingElements?: string[];
  question?: string | null;
  officialAnswer?: string | null;
  riddleTitle?: string | null;
}

const DIFFICULTY_MAP: Record<number, { en: string; fr: string }> = {
  1: { en: "Novice", fr: "Novice" },
  2: { en: "Skilled", fr: "Confirmé" },
  3: { en: "Expert", fr: "Expert" },
  4: { en: "Grandmaster", fr: "Grand Maître" },
};

const DEFAULT_DURATION = 45 * 60;

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
    "Your attempt is saved. Analyse the hints to improve your next answer.",
  hintsUsed: overrides.hintsUsed ?? base?.hintsUsed ?? 0,
  timeSpent: overrides.timeSpent ?? base?.timeSpent ?? 0,
  userMessages: overrides.userMessages ?? base?.userMessages ?? 0,
  timeRemaining: overrides.timeRemaining ?? base?.timeRemaining ?? 0,
  rankingPercent: overrides.rankingPercent,
  beatenPlayers: overrides.beatenPlayers,
  totalPlayers: overrides.totalPlayers,
  hints: overrides.hints ?? base?.hints ?? [],
  resultImageURL: overrides.resultImageURL ?? base?.resultImageURL ?? null,
  judgeConfidence: overrides.judgeConfidence ?? base?.judgeConfidence ?? null,
  judgeMissingElements: overrides.judgeMissingElements ?? base?.judgeMissingElements ?? [],
  question: overrides.question ?? base?.question ?? null,
  officialAnswer: overrides.officialAnswer ?? base?.officialAnswer ?? null,
  riddleTitle: overrides.riddleTitle ?? base?.riddleTitle ?? null,
});

const useViewportSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
};

const getDateFormatter = (language: string) =>
  new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function RiddleClient() {
  const { t, language } = useTranslations();
  const [riddle, setRiddle] = useState<RiddlePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [userAnswer, setUserAnswer] = useState("");

  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [scoreboardError, setScoreboardError] = useState<string | null>(null);
  const [scoreboardLoading, setScoreboardLoading] = useState(false);

  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const viewport = useViewportSize();

  const [countdownState, countdownControls] = useCountdown();
  const { start, pause, reset } = countdownControls;

  const loadRiddle = useCallback(async () => {
    setLoading(true);
    setError(null);
    reset();
    try {
      const response = await fetch("/api/riddle-today", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to load the daily riddle.");
      }
      const payload = (await response.json()) as RiddlePayload | null;
      if (!payload) {
        throw new Error("No riddle available");
      }
      setRiddle(payload);
      setRevealedHints([]);
      setUserAnswer("");
      setScoreResult(null);
      setShowScoreboard(false);
      setScoreboardError(null);

      try {
        const scoreboardResponse = await fetch(`/api/riddle-scoreboard?riddleId=${payload.id}&lang=${language}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (scoreboardResponse.ok) {
          const scoreboardData = await scoreboardResponse.json();
          if (scoreboardData?.hasScore) {
            const estimatedRemaining = Math.max(
              0,
              (payload.duration ?? DEFAULT_DURATION) - (scoreboardData.duration ?? 0),
            );
            const merged = mergeScoreData(null, {
              score: scoreboardData.score ?? 0,
              rankingPercent: scoreboardData.rankingPercent ?? 0,
              beatenPlayers: scoreboardData.beatenPlayers ?? 0,
              totalPlayers: scoreboardData.totalPlayers ?? 0,
              hintsUsed: scoreboardData.hintsUsed ?? 0,
              timeSpent: scoreboardData.duration ?? 0,
              userMessages: scoreboardData.msgCount ?? 1,
              timeRemaining: estimatedRemaining,
              hints: scoreboardData.hints ?? [],
              resultImageURL: scoreboardData.resultImageURL ?? null,
              officialAnswer: scoreboardData.officialAnswer ?? null,
              question: scoreboardData.question ?? null,
              riddleTitle: scoreboardData.riddleTitle ?? null,
            });
            setScoreResult(merged);
            setShowScoreboard(true);
            pause();
            return;
          }
        }
      } catch (scoreError) {
        console.error(scoreError);
      }

      start(payload.duration ?? DEFAULT_DURATION);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [start, reset, language, pause]);

  useEffect(() => {
    void loadRiddle();
  }, [loadRiddle]);

  const difficultyLabel = useMemo(() => {
    if (!riddle?.difficulty) return language === "fr" ? "À confirmer" : "To confirm";
    const entry = DIFFICULTY_MAP[riddle.difficulty];
    if (!entry) return language === "fr" ? "À confirmer" : "To confirm";
    return entry[language];
  }, [riddle?.difficulty, language]);

  const releaseDateLabel = useMemo(() => {
    if (!riddle?.releaseDate) return null;
    const date = new Date(riddle.releaseDate);
    if (Number.isNaN(date.getTime())) return null;
    return getDateFormatter(language).format(date);
  }, [riddle?.releaseDate, language]);

  const hints = useMemo(() => {
    if (!riddle) return [] as string[];
    return [riddle.hint1, riddle.hint2, riddle.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );
  }, [riddle]);

  const hasMoreHints = revealedHints.length < hints.length;

  const handleRevealHint = useCallback(() => {
    if (!hasMoreHints) return;
    setRevealedHints((prev) => [...prev, prev.length]);
  }, [hasMoreHints]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!riddle || !userAnswer.trim() || submittingAnswer || scoreResult) return;

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
          userMessages: 1,
          hints: revealedHints.map((index) => hints[index]).filter(Boolean),
          language,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || t("scoreboardErrors.generic"));
      }

      const data = await response.json();
      if (data?.requiresAuth) {
        setScoreResult(null);
        setScoreboardError(data.error ?? t("scoreboardErrors.auth"));
        setShowScoreboard(true);
        setSubmittingAnswer(false);
        return;
      }
      const result = data as ScoreResult;
      setScoreResult(result);
      pause();
      setShowScoreboard(true);
    } catch (err) {
      setScoreboardError(err instanceof Error ? err.message : t("scoreboardErrors.generic"));
    } finally {
      setSubmittingAnswer(false);
    }
  }, [riddle, userAnswer, submittingAnswer, scoreResult, countdownState.totalDuration, countdownState.timeRemaining, revealedHints, hints, pause, language, t]);

  const fetchScoreboard = useCallback(async () => {
    if (!riddle) return;
    setScoreboardLoading(true);
    setScoreboardError(null);
    try {
      const response = await fetch(`/api/riddle-scoreboard?riddleId=${riddle.id}&lang=${language}`, { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        setScoreboardError(t("scoreboardErrors.auth"));
        setShowScoreboard(true);
        setScoreboardLoading(false);
        return;
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || t("scoreboardErrors.generic"));
      }
      const data = await response.json();
      if (data?.requiresAuth) {
        setScoreboardError(data.error ?? t("scoreboardErrors.auth"));
        setShowScoreboard(true);
        setScoreboardLoading(false);
        return;
      }
      if (data?.hasScore) {
        const estimatedRemaining = Math.max(
          0,
          (riddle?.duration ?? DEFAULT_DURATION) - (data.duration ?? scoreResult?.timeSpent ?? 0),
        );
        const merged = mergeScoreData(scoreResult, {
          score: data.score ?? 0,
          rankingPercent: data.rankingPercent ?? 0,
          beatenPlayers: data.beatenPlayers ?? 0,
          totalPlayers: data.totalPlayers ?? 0,
          hintsUsed: data.hintsUsed ?? scoreResult?.hintsUsed ?? revealedHints.length,
          timeSpent: data.duration ?? scoreResult?.timeSpent ?? 0,
          userMessages: data.msgCount ?? scoreResult?.userMessages ?? 1,
          timeRemaining: scoreResult?.timeRemaining ?? estimatedRemaining,
          hints: data.hints ?? scoreResult?.hints ?? hints,
          resultImageURL: data.resultImageURL ?? scoreResult?.resultImageURL ?? null,
          officialAnswer: data.officialAnswer ?? scoreResult?.officialAnswer ?? null,
          question: data.question ?? scoreResult?.question ?? null,
          riddleTitle: data.riddleTitle ?? scoreResult?.riddleTitle ?? null,
        });
        setScoreResult(merged);
        setShowScoreboard(true);
      } else {
        setScoreboardError(t("scoreboardErrors.none"));
        setShowScoreboard(true);
      }
    } catch (err) {
      setScoreboardError(err instanceof Error ? err.message : t("scoreboardErrors.generic"));
      setShowScoreboard(true);
    } finally {
      setScoreboardLoading(false);
    }
  }, [riddle, scoreResult, hints, revealedHints, t, language]);

  useEffect(() => {
    if (!showScoreboard && countdownState.timeRemaining === 0) {
      void fetchScoreboard();
      pause();
    }
  }, [countdownState.timeRemaining, fetchScoreboard, showScoreboard, pause]);

  useEffect(() => {
    if (showScoreboard && scoreResult && !scoreResult.resultImageURL) {
      const timer = setTimeout(() => {
        void fetchScoreboard();
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showScoreboard, scoreResult, fetchScoreboard]);

  const scoreboardShouldDisplay = showScoreboard || Boolean(scoreResult);

  const renderLoading = () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center text-white/70">
      <TopBar />
      <div className="relative mt-24 flex flex-col items-center gap-3">
        <Loader2 className="h-12 w-12 animate-spin text-white/60" />
        <p>{t("loading.title")}</p>
        <p className="text-sm text-white/50">{t("loading.subtitle")}</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 text-center text-white/70">
      <TopBar />
      <div className="mt-24 flex flex-col items-center gap-6">
        <div className="glass-panel flex h-24 w-24 items-center justify-center text-white">
          <TriangleAlert className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">{t("error.title")}</h1>
          <p className="max-w-sm text-sm text-white/70">{error ?? t("error.subtitle")}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-white/80 px-6 py-2 text-sm font-semibold text-background transition hover:bg-white"
          onClick={loadRiddle}
        >
          {t("error.cta")}
        </button>
      </div>
    </div>
  );

  const renderScoreboard = () => {
    const hasScore = Boolean(scoreResult);
    return (
      <div className="relative min-h-screen pb-24 text-white">
        <TopBar />
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 pt-24 text-center">
          {hasScore && viewport.width > 0 && viewport.height > 0 && (
            <Confetti width={viewport.width} height={viewport.height} numberOfPieces={220} recycle={false} />
          )}

          {!hasScore ? (
            <div className="glass-panel flex flex-col items-center gap-4 px-10 py-14 text-white/80">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
              <p>{t("scoreboard.loading")}</p>
            </div>
          ) : (
            <>
              <div className="animate-fade-up space-y-3">
                <span className="muted-label">{t("scoreboard.badge")}</span>
                <h1 className="text-4xl font-semibold text-white">{t("scoreboard.heading", { id: riddle?.id })}</h1>
                {scoreResult?.riddleTitle && (
                  <p className="text-base text-amber-100/80">{scoreResult.riddleTitle}</p>
                )}
              </div>

              {scoreResult?.resultImageURL && (
                <div className="elevated-card w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scoreResult.resultImageURL}
                    alt="Riddle result illustration"
                    className="h-72 w-full object-cover"
                  />
                </div>
              )}

              <div className="elevated-card w-full space-y-8 p-10 text-left text-white/80">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/50">{t("scoreboard.scoreLabel")}</p>
                  <p className="text-5xl font-semibold text-white">{scoreResult?.score ?? 0}</p>
                  <p className="whitespace-pre-line text-base text-white/80">
                    {scoreResult?.feedback ?? t("scoreboard.fallbackFeedback")}
                  </p>
                  {typeof scoreResult?.judgeConfidence === "number" && scoreResult.judgeConfidence !== null && (
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                      {t("scoreboard.confidence", { value: Math.round(scoreResult.judgeConfidence * 100) })}
                    </p>
                  )}
                </div>

                {!scoreResult?.correct && scoreResult?.judgeMissingElements && scoreResult.judgeMissingElements.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-semibold text-white">{t("scoreboard.missingTitle")}</p>
                    <ul className="mt-3 space-y-2 text-sm text-white/75">
                      {scoreResult.judgeMissingElements.map((element, index) => (
                        <li key={`judge-missing-${index}-${element}`} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />
                          <span>{element}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="glass-panel flex flex-col items-center justify-center gap-3 px-8 py-10 text-center text-white">
                    <span className="muted-label text-white/60">{t("scoreboard.outrankLabel")}</span>
                    <span className="text-6xl font-black">{scoreResult?.rankingPercent ?? 0}%</span>
                    <span className="text-xs text-white/60">
                      {t("scoreboard.players", { beaten: scoreResult?.beatenPlayers ?? 0, total: scoreResult?.totalPlayers ?? 0 })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="glass-panel px-6 py-5 text-white">
                      <p className="muted-label text-white/60">{t("scoreboard.timeUsed")}</p>
                      <p className="mt-2 text-lg font-medium text-white">{formatSeconds(scoreResult?.timeSpent ?? 0)}</p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-white to-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, ((scoreResult?.timeSpent ?? 0) / Math.max(1, riddle?.duration ?? DEFAULT_DURATION)) * 100))}%` }}
                        />
                      </div>
                    </div>
                    <div className="glass-panel px-6 py-5 text-white">
                      <p className="muted-label text-white/60">{t("scoreboard.hintsUsed")}</p>
                      <p className="mt-2 text-lg font-medium text-white">{scoreResult?.hintsUsed ?? revealedHints.length}</p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
                          style={{ width: `${Math.min(100, ((scoreResult?.hintsUsed ?? revealedHints.length) / Math.max(1, hints.length)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {scoreResult?.hints && scoreResult.hints.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
                    <p className="muted-label text-white/60">{t("scoreboard.hintListTitle")}</p>
                    <ul className="mt-3 space-y-2 text-sm text-white/75">
                      {scoreResult.hints.map((hint, index) => (
                        <li key={`score-hint-${index}`} className="rounded-xl bg-white/10 px-4 py-3 shadow-inner">
                          <span className="font-semibold text-white/80">{language === "fr" ? `Indice ${index + 1} :` : `Hint ${index + 1}:`}</span> {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {scoreboardError && (
                  <p className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {scoreboardError}
                  </p>
                )}
              </div>

              <div className="glass-panel w-full space-y-8 p-10 text-left text-white/80">
                <section className="space-y-3">
                  <p className="muted-label">{t("scoreboard.questionTitle")}</p>
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/80">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {scoreResult?.question?.trim()?.length
                        ? scoreResult.question
                        : language === "fr"
                          ? "L'énoncé détaillé sera bientôt disponible."
                          : "The full question will be available soon."}
                    </ReactMarkdown>
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="muted-label">{t("scoreboard.solutionTitle")}</p>
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/80">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {scoreResult?.officialAnswer?.trim()?.length
                        ? scoreResult.officialAnswer
                        : language === "fr"
                          ? "La solution détaillée arrive bientôt."
                          : "The detailed solution will appear soon."}
                    </ReactMarkdown>
                  </div>
                </section>
              </div>

              <div className="flex flex-col items-center gap-4 text-sm text-white/70">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
                  onClick={() => window.alert(language === "fr" ? "Apple Pay arrive bientôt. Merci pour ton enthousiasme !" : "Apple Pay support is coming soon. Thanks for your enthusiasm!")}
                >
                  {t("scoreboard.support")}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-amber-200/40 px-5 py-2 font-medium text-white transition hover:bg-amber-300/10"
                  onClick={() => window.location.assign("/")}
                >
                  {t("scoreboard.backHome")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRiddle = () => (
    <div className="relative min-h-screen pb-24 text-white">
      <TopBar />
      <main className="mx-auto mt-20 flex w-full max-w-6xl flex-col gap-12 px-6">
        <header className="animate-fade-up space-y-6 text-center lg:text-left">
          <span className="muted-label">{t("riddle.stageLabel")}</span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {riddle?.title ?? (language === "fr" ? "Énigme mystère" : "Mystery riddle")}
            <span className="block bg-gradient-to-r from-white via-primary to-accent bg-clip-text text-transparent">
              {t("riddle.heroTitle")}
            </span>
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/70 lg:justify-start">
            <span className="rounded-full border border-white/20 px-4 py-1 font-semibold text-white/80">
              {t("riddle.puzzleNumber", { id: riddle?.id ?? "?" })}
            </span>
            <span className="rounded-full border border-white/20 px-4 py-1 font-semibold text-white/80">
              {t("riddle.difficulty", { label: difficultyLabel })}
            </span>
            {releaseDateLabel && (
              <span className="rounded-full border border-white/20 px-4 py-1 font-semibold text-white/80">
                {t("riddle.releaseDate", { date: releaseDateLabel })}
              </span>
            )}
            <span className="rounded-full border border-white/20 px-4 py-1 font-semibold text-white/80">
              {t("riddle.targetTime", { minutes: Math.floor((riddle?.duration ?? DEFAULT_DURATION) / 60) })}
            </span>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="elevated-card space-y-8 p-10 text-left text-white/80">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.35em] text-white/50">
              <span>#{riddle?.id ?? 0}</span>
              <span>{difficultyLabel}</span>
            </div>
            <div className="glow-divider" />
            <div className="space-y-3">
              <p className="muted-label">{t("riddle.promptLabel")}</p>
              <div className="prose prose-invert max-w-none text-base leading-relaxed text-white/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{riddle?.question ?? ""}</ReactMarkdown>
              </div>
            </div>
          </article>

          <div className="flex flex-col gap-6">
            <TimerPanel
              state={countdownState}
              label={t("timer.label")}
              helper={t("timer.helper")}
              statusLabels={{
                finished: t("timer.finished"),
                critical: t("timer.critical"),
                running: t("timer.running"),
                idle: t("timer.idle"),
              }}
            />

            {riddle?.imageURL ? (
              <div className="glass-panel overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={riddle.imageURL} alt={t("riddle.heroTitle") ?? "Riddle illustration"} className="h-72 w-full object-cover" />
              </div>
            ) : (
              <div className="glass-panel flex h-72 items-center justify-center text-sm text-white/60">
                {language === "fr" ? "Illustration en cours de préparation…" : "Illustration loading soon…"}
              </div>
            )}

            <section className="glass-panel space-y-4 p-8 text-white/80">
              <h3 className="text-lg font-semibold text-white">{t("riddle.answerLabel")}</h3>
              <textarea
                className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/10"
                placeholder={t("riddle.answerPlaceholder")}
                value={userAnswer}
                onChange={(event) => setUserAnswer(event.target.value)}
                disabled={submittingAnswer || Boolean(scoreResult)}
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                <span>{t("riddle.status.timeRemaining")}: {formatSeconds(countdownState.timeRemaining)}</span>
                <span>{t("riddle.status.hintsUsed")}: {revealedHints.length}</span>
              </div>
              {scoreResult && !scoreResult.correct && (
                <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {scoreResult.feedback}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-white/80 px-5 py-2 text-sm font-semibold text-background transition hover:bg-white"
                  onClick={handleSubmitAnswer}
                  disabled={submittingAnswer || Boolean(scoreResult)}
                >
                  {submittingAnswer ? t("riddle.submitLoading") : t("riddle.submit")}
                </button>
                {!scoreResult && (
                  <button
                    type="button"
                    className="rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    onClick={fetchScoreboard}
                    disabled={scoreboardLoading}
                  >
                    {scoreboardLoading ? t("scoreboardControls.viewLoading") : t("scoreboardControls.view")}
                  </button>
                )}
              </div>
            </section>

            <section className="glass-panel space-y-5 p-8 text-white/80">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{t("riddle.hintSectionTitle")}</h3>
                {hasMoreHints && (
                  <button
                    type="button"
                    className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
                    onClick={handleRevealHint}
                  >
                    {t("riddle.hintReveal", { next: revealedHints.length + 1 })}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {revealedHints.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/60">
                    {t("riddle.hintReminder")}
                  </p>
                )}
                {revealedHints.map((index) => (
                  <div key={`hint-${index}`} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white/80">
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">{t("riddle.hintSectionTitle")}</span>
                    <p className="mt-2 text-sm leading-relaxed">{hints[index]}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );

  if (loading) return renderLoading();
  if (error || !riddle) return renderError();
  if (scoreboardShouldDisplay) return renderScoreboard();
  return renderRiddle();
}
