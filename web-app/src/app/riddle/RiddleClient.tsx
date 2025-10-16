
"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import Confetti from "react-confetti";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TimerPanel } from "@/components/riddle/TimerPanel";
import { useCountdown } from "@/hooks/useCountdown";
import { TopBar } from "@/components/layout/TopBar";
import { useTranslations } from "@/components/providers/LanguageProvider";
import { SOCIAL_LINKS } from "@/lib/premium";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

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

type PremiumAccessState = {
  unlocked: boolean;
  type: "single" | "subscription" | null;
  validUntil: string | null;
};

type UnlockOptions = {
  single: { amountCents: number; currency: string };
  subscription: { amountCents: number; currency: string };
};

type SocialLinks = {
  instagramHandle: string;
  instagramUrl: string;
  linkedinUrl: string;
};

type StripePaymentRequestPaymentMethodEvent = {
  paymentMethod: { id: string };
  complete: (status: "success" | "fail") => void;
};

type StripePaymentRequest = {
  canMakePayment: () => Promise<{ applePay?: boolean } | null>;
  update: (details: { total: { label: string; amount: number } }) => void;
  on: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
  off: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
};

type Stripe = {
  paymentRequest: (options: {
    country: string;
    currency: string;
    total: { label: string; amount: number };
    requestPayerEmail?: boolean;
    requestPayerName?: boolean;
  }) => StripePaymentRequest;
  confirmCardPayment: (clientSecret: string) => Promise<{ error?: { message?: string } }>;
  elements: () => {
    create: (
      type: "paymentRequestButton",
      options: {
        paymentRequest: StripePaymentRequest;
        style?: {
          paymentRequestButton?: {
            type?: string;
            theme?: string;
            height?: string;
          };
        };
      },
    ) => { mount: (element: Element | string) => void; unmount: () => void };
  };
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => Stripe;
  }
}

interface ScoreResult {
  correct: boolean;
  score: number;
  feedback: string | null;
  hintsUsed: number;
  timeSpent: number;
  userMessages: number;
  timeRemaining: number;
  rankingPercent: number;
  beatenPlayers: number;
  totalPlayers: number;
  hints?: string[];
  judgeConfidence?: number | null;
  judgeMissingElements?: string[];
  question?: string | null;
  officialAnswer?: string | null;
  riddleTitle?: string | null;
  locked?: boolean;
  premiumAccess?: PremiumAccessState | null;
  unlockOptions?: UnlockOptions | null;
  socialLinks?: SocialLinks | null;
  feedbackShort?: string | null;
  lockReason?: string | null;
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

const logRiddleClient = (...args: unknown[]) => {
  console.log("[RiddleClient]", ...args);
};

const mergeScoreData = (
  base: ScoreResult | null,
  overrides: Partial<ScoreResult> & { score: number; rankingPercent: number; beatenPlayers: number; totalPlayers: number },
): ScoreResult => ({
  correct: overrides.correct ?? base?.correct ?? false,
  score: overrides.score,
  feedback:
    overrides.feedback !== undefined
      ? overrides.feedback
      : base?.feedback ?? "Your attempt is saved. Analyse the hints to improve your next answer.",
  hintsUsed: overrides.hintsUsed ?? base?.hintsUsed ?? 0,
  timeSpent: overrides.timeSpent ?? base?.timeSpent ?? 0,
  userMessages: overrides.userMessages ?? base?.userMessages ?? 0,
  timeRemaining: overrides.timeRemaining ?? base?.timeRemaining ?? 0,
  rankingPercent: overrides.rankingPercent,
  beatenPlayers: overrides.beatenPlayers,
  totalPlayers: overrides.totalPlayers,
  hints: overrides.hints ?? base?.hints ?? [],
  judgeConfidence: overrides.judgeConfidence ?? base?.judgeConfidence ?? null,
  judgeMissingElements: overrides.judgeMissingElements ?? base?.judgeMissingElements ?? [],
  question: overrides.question ?? base?.question ?? null,
  officialAnswer: overrides.officialAnswer ?? base?.officialAnswer ?? null,
  riddleTitle: overrides.riddleTitle ?? base?.riddleTitle ?? null,
  locked: overrides.locked ?? base?.locked ?? false,
  premiumAccess: overrides.premiumAccess ?? base?.premiumAccess ?? null,
  unlockOptions: overrides.unlockOptions ?? base?.unlockOptions ?? null,
  socialLinks: overrides.socialLinks ?? base?.socialLinks ?? null,
  feedbackShort:
    overrides.feedbackShort !== undefined ? overrides.feedbackShort : base?.feedbackShort ?? null,
  lockReason: overrides.lockReason ?? base?.lockReason ?? null,
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

const MIN_DONATION_CENTS = 10;
const MAX_DONATION_CENTS = 200;
const DONATION_STEP_CENTS = 10;
const DEFAULT_DONATION_CENTS = 30;

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

const SupportApplePaySection = ({ t, language }: { t: TranslateFn; language: "en" | "fr" }) => {
  const [amountCents, setAmountCents] = useState(DEFAULT_DONATION_CENTS);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<StripePaymentRequest | null>(null);
  const [canUseApplePay, setCanUseApplePay] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);

  const formattedAmount = useMemo(
    () =>
      new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(amountCents / 100),
    [amountCents, language],
  );

  const supportTitle = t("scoreboard.supportTitle");
  const supportSubtitle = t("scoreboard.supportSubtitle");
  const amountLabel = t("scoreboard.supportAmountLabel");
  const totalLabel = t("scoreboard.supportTotalLabel");
  const unavailable = t("scoreboard.supportUnavailable");
  const configureMessage = t("scoreboard.supportConfigure");
  const processingMessage = t("scoreboard.supportProcessing");
  const successMessage = t("scoreboard.supportSuccess", { amount: formattedAmount });
  const genericError = t("scoreboard.supportErrorGeneric");
  const scriptError = t("scoreboard.supportScriptError");

  useEffect(() => {
    if (typeof window === "undefined" || !STRIPE_PUBLISHABLE_KEY) return;
    let cancelled = false;

    const initialiseStripe = () => {
      if (cancelled || !window.Stripe) return;
      try {
        const instance = window.Stripe(STRIPE_PUBLISHABLE_KEY);
        setStripe(instance);
      } catch (error) {
        console.error("[SupportApplePay] Failed to initialise Stripe", error);
        setErrorMessage(scriptError);
        setStatus("error");
      }
    };

    if (window.Stripe) {
      initialiseStripe();
      return () => {
        cancelled = true;
      };
    }

    let script = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://js.stripe.com/v3";
      script.async = true;
      script.onload = initialiseStripe;
      script.onerror = () => {
        if (!cancelled) {
          setErrorMessage(scriptError);
          setStatus("error");
        }
      };
      document.body.appendChild(script);
    } else {
      script.addEventListener("load", initialiseStripe);
    }

    return () => {
      cancelled = true;
      if (script) {
        script.removeEventListener("load", initialiseStripe);
        script.onload = null;
        script.onerror = null;
      }
    };
  }, [scriptError]);

  useEffect(() => {
    if (!stripe) {
      setPaymentRequest(null);
      setCanUseApplePay(false);
      return;
    }

    const request = stripe.paymentRequest({
      country: "FR",
      currency: "eur",
      total: { label: totalLabel, amount: DEFAULT_DONATION_CENTS },
      requestPayerEmail: true,
      requestPayerName: true,
    });

    let active = true;
    request.canMakePayment().then((result) => {
      if (!active) return;
      const supported = Boolean(result?.applePay);
      setCanUseApplePay(supported);
      if (!supported) {
        setErrorMessage(unavailable);
      } else {
        setErrorMessage(null);
      }
    });

    setPaymentRequest(request);

    return () => {
      active = false;
      setPaymentRequest(null);
      setCanUseApplePay(false);
    };
  }, [stripe, totalLabel, unavailable]);

  useEffect(() => {
    if (!paymentRequest) return;
    paymentRequest.update({
      total: {
        label: totalLabel,
        amount: Math.min(Math.max(amountCents, MIN_DONATION_CENTS), MAX_DONATION_CENTS),
      },
    });
  }, [paymentRequest, amountCents, totalLabel]);

  useEffect(() => {
    if (!paymentRequest || !stripe) return;

    const handlePaymentMethod = async (event: StripePaymentRequestPaymentMethodEvent) => {
      if (!stripe) {
        event.complete("fail");
        setStatus("error");
        setErrorMessage(genericError);
        return;
      }
      setStatus("processing");
      setErrorMessage(null);

      try {
        const response = await fetch("/api/support/donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: Math.min(Math.max(amountCents, MIN_DONATION_CENTS), MAX_DONATION_CENTS),
            paymentMethodId: event.paymentMethod.id,
            locale: language,
          }),
        });
        const payload = (await response.json()) as {
          clientSecret?: string | null;
          requiresAction?: boolean;
          error?: string;
        };

        if (!response.ok) {
          const message = typeof payload?.error === "string" && payload.error.length > 0 ? payload.error : genericError;
          setStatus("error");
          setErrorMessage(message);
          event.complete("fail");
          return;
        }

        if (payload?.requiresAction && payload?.clientSecret) {
          const confirmation = await stripe.confirmCardPayment(payload.clientSecret);
          if (confirmation.error) {
            setStatus("error");
            setErrorMessage(confirmation.error.message ?? genericError);
            event.complete("fail");
            return;
          }
        }

        setStatus("success");
        setErrorMessage(null);
        event.complete("success");
      } catch (error) {
        console.error("[SupportApplePay] Donation failed", error);
        setStatus("error");
        setErrorMessage(genericError);
        event.complete("fail");
      }
    };

    paymentRequest.on("paymentmethod", handlePaymentMethod);
    return () => {
      paymentRequest.off("paymentmethod", handlePaymentMethod);
    };
  }, [paymentRequest, stripe, amountCents, genericError, language]);

  useEffect(() => {
    if (!stripe || !paymentRequest || !buttonContainerRef.current || !canUseApplePay) return;
    const elements = stripe.elements();
    const button = elements.create("paymentRequestButton", {
      paymentRequest,
      style: {
        paymentRequestButton: {
          type: "donate",
          theme: "dark",
          height: "44px",
        },
      },
    });

    const container = buttonContainerRef.current;
    if (container) {
      container.innerHTML = "";
      button.mount(container);
    }

    return () => {
      try {
        button.unmount();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [stripe, paymentRequest, canUseApplePay]);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => {
      setStatus("idle");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number.parseInt(event.target.value, 10);
    if (!Number.isNaN(nextValue)) {
      setAmountCents(nextValue);
      if (status !== "processing") {
        setStatus("idle");
        setErrorMessage(null);
      }
    }
  };

  const sliderDisabled = status === "processing";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-lg">
      <p className="text-sm font-semibold text-white/80">{supportTitle}</p>
      <p className="mt-1 text-xs text-white/60">{supportSubtitle}</p>

      <div className="mt-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-white/50">
          {amountLabel}
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={MIN_DONATION_CENTS}
            max={MAX_DONATION_CENTS}
            step={DONATION_STEP_CENTS}
            value={amountCents}
            onChange={handleSliderChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-amber-300"
            disabled={sliderDisabled}
          />
          <span className="min-w-[70px] text-sm font-semibold text-white">{formattedAmount}</span>
        </div>
      </div>

      {STRIPE_PUBLISHABLE_KEY ? (
        canUseApplePay ? (
          <div className="mt-4">
            <div ref={buttonContainerRef} className="overflow-hidden rounded-full shadow-lg" />
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            {errorMessage ?? unavailable}
          </p>
        )
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200/40 bg-amber-200/10 px-3 py-2 text-xs text-amber-100">
          {configureMessage}
        </p>
      )}

      {status !== "idle" && (
        <p
          className={`mt-3 text-xs ${
            status === "processing"
              ? "text-white/70"
              : status === "success"
                ? "text-emerald-200"
                : "text-rose-200"
          }`}
        >
          {status === "processing"
            ? processingMessage
            : status === "success"
              ? successMessage
              : errorMessage ?? genericError}
        </p>
      )}
    </div>
  );
};

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
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<"single" | "subscription" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const viewport = useViewportSize();

  const [countdownState, countdownControls] = useCountdown();
  const { start, pause, reset } = countdownControls;

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }),
    [language],
  );

  const loadRiddle = useCallback(async () => {
    setLoading(true);
    setError(null);
    reset();
    try {
      logRiddleClient("Loading daily riddle");
      const response = await fetch(`/api/riddle-today?lang=${language}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.text();
        logRiddleClient("Failed to load riddle", { status: response.status, body });
        throw new Error(body || "Unable to load the daily riddle.");
      }
      const payload = (await response.json()) as RiddlePayload | null;
      if (!payload) {
        throw new Error("No riddle available");
      }
      logRiddleClient("Riddle loaded", {
        riddleId: payload.id,
        duration: payload.duration,
        difficulty: payload.difficulty,
      });
      setRiddle(payload);
      setRevealedHints([]);
      setUserAnswer("");
      setScoreResult(null);
      setShowScoreboard(false);
      setScoreboardError(null);
      start(payload.duration ?? DEFAULT_DURATION);
    } catch (err) {
      logRiddleClient("Error while loading riddle", err);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [start, reset, language]);

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

  const handleCheckout = useCallback(
    async (plan: "single" | "subscription") => {
      if (plan === "single" && (!riddle?.id || riddle.id <= 0)) {
        setCheckoutError(t("scoreboard.premiumErrorUnavailable"));
        return;
      }

      setCheckoutError(null);
      setCheckoutLoading(plan);

      try {
        const response = await fetch("/api/payments/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            plan === "single"
              ? { kind: "single_riddle", riddleId: riddle?.id, locale: language }
              : { kind: "subscription", locale: language },
          ),
        });

        const data = (await response.json()) as { url?: string; error?: string };

        if (!response.ok || !data?.url) {
          throw new Error(
            typeof data?.error === "string" && data.error.length > 0
              ? data.error
              : t("scoreboard.premiumErrorGeneric"),
          );
        }

        window.location.assign(data.url);
      } catch (error) {
        console.error("[Checkout] Failed to start payment", error);
        setCheckoutError(
          error instanceof Error && error.message.length > 0
            ? error.message
            : t("scoreboard.premiumErrorGeneric"),
        );
      } finally {
        setCheckoutLoading(null);
      }
    },
    [language, riddle?.id, t],
  );

  const handleSubmitAnswer = useCallback(async () => {
    if (!riddle || !userAnswer.trim() || submittingAnswer || scoreResult) return;

    setSubmittingAnswer(true);
    setShowScoreboard(false);
    setScoreboardError(null);
    pause();

    try {
      logRiddleClient("Submitting answer", {
        riddleId: riddle.id,
        answerLength: userAnswer.length,
        totalDuration: countdownState.totalDuration,
        timeRemaining: countdownState.timeRemaining,
        hintsUsed: revealedHints.length,
        language,
      });
      const response = await fetch("/api/riddle-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
        logRiddleClient("Submit failed", { status: response.status, body });
        throw new Error(body || t("scoreboardErrors.generic"));
      }

      const data = await response.json();
      if (data?.requiresAuth) {
        logRiddleClient("Submit requires auth", { riddleId: riddle.id });
        setScoreResult(null);
        setScoreboardError(data.error ?? t("scoreboardErrors.auth"));
        setShowScoreboard(true);
        setSubmittingAnswer(false);
        return;
      }
      const result = data as ScoreResult;
      const usedHints = revealedHints.map((index) => hints[index]).filter((hint): hint is string => Boolean(hint));
      const enhancedResult: ScoreResult = {
        ...result,
        hints:
          result.hints && result.hints.length > 0
            ? result.hints
            : result.locked
              ? []
              : usedHints,
        riddleTitle: result.riddleTitle ?? riddle.title ?? null,
      };
      logRiddleClient("Submit succeeded", {
        riddleId: riddle.id,
        score: enhancedResult.score,
        rankingPercent: enhancedResult.rankingPercent,
      });
      setScoreResult(enhancedResult);
      setCheckoutError(null);
      setCheckoutLoading(null);
      pause();
      setShowScoreboard(true);
    } catch (err) {
      logRiddleClient("Submit threw", err);
      setScoreboardError(err instanceof Error ? err.message : t("scoreboardErrors.generic"));
    } finally {
      setSubmittingAnswer(false);
    }
  }, [riddle, userAnswer, submittingAnswer, scoreResult, countdownState.totalDuration, countdownState.timeRemaining, revealedHints, hints, pause, language, t]);

  const fetchScoreboard = useCallback(async () => {
    if (!riddle) return;
    logRiddleClient("Fetching scoreboard", { riddleId: riddle.id, language });
    setScoreboardError(null);
    try {
      const response = await fetch(`/api/riddle-scoreboard?riddleId=${riddle.id}&lang=${language}`, { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        logRiddleClient("Scoreboard 401", { riddleId: riddle.id });
        setScoreboardError(t("scoreboardErrors.auth"));
        setShowScoreboard(true);
        return;
      }
      if (!response.ok) {
        const body = await response.text();
        logRiddleClient("Scoreboard failed", { status: response.status, body });
        throw new Error(body || t("scoreboardErrors.generic"));
      }
      const data = await response.json();
      if (data?.requiresAuth) {
        logRiddleClient("Scoreboard requires auth payload", { riddleId: riddle.id });
        setScoreboardError(data.error ?? t("scoreboardErrors.auth"));
        setShowScoreboard(true);
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
          officialAnswer: data.officialAnswer ?? scoreResult?.officialAnswer ?? null,
          question: data.question ?? scoreResult?.question ?? null,
          riddleTitle: data.riddleTitle ?? scoreResult?.riddleTitle ?? null,
          feedback: data.feedback ?? scoreResult?.feedback ?? null,
          feedbackShort: data.feedbackShort ?? scoreResult?.feedbackShort ?? null,
          locked: data.locked ?? scoreResult?.locked ?? false,
          premiumAccess: data.premiumAccess ?? scoreResult?.premiumAccess ?? null,
          unlockOptions: data.unlockOptions ?? scoreResult?.unlockOptions ?? null,
          socialLinks: data.socialLinks ?? scoreResult?.socialLinks ?? null,
          lockReason: data.lockReason ?? scoreResult?.lockReason ?? null,
        });
        logRiddleClient("Scoreboard fetched", {
          riddleId: riddle.id,
          score: merged.score,
          rankingPercent: merged.rankingPercent,
        });
        setScoreResult(merged);
        setCheckoutError(null);
        setCheckoutLoading(null);
        setShowScoreboard(true);
      } else {
        logRiddleClient("Scoreboard has no score", { riddleId: riddle.id });
        setScoreboardError(t("scoreboardErrors.none"));
        setShowScoreboard(true);
      }
    } catch (err) {
      logRiddleClient("Scoreboard threw", err);
      setScoreboardError(err instanceof Error ? err.message : t("scoreboardErrors.generic"));
      setShowScoreboard(true);
    }
  }, [riddle, scoreResult, hints, revealedHints, t, language]);

  useEffect(() => {
    if (!showScoreboard && countdownState.timeRemaining === 0) {
      logRiddleClient("Timer reached zero, requesting scoreboard");
      void fetchScoreboard();
      pause();
    }
  }, [countdownState.timeRemaining, fetchScoreboard, showScoreboard, pause]);

  const scoreboardShouldDisplay = showScoreboard || Boolean(scoreResult);

  const renderLoading = () => (
    <div className="flex min-h-screen flex-col text-white/70">
      <TopBar />
      <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-white/60" />
        <p>{t("loading.title")}</p>
        <p className="text-sm text-white/50">{t("loading.subtitle")}</p>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="flex min-h-screen flex-col text-white/70">
      <TopBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="glass-panel flex h-24 w-24 items-center justify-center text-white">
          <TriangleAlert className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">{t("error.title")}</h1>
          <p className="max-w-sm text-sm text-white/70">{error ?? t("error.subtitle")}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
          onClick={loadRiddle}
        >
          {t("error.cta")}
        </button>
      </div>
    </div>
  );

  const renderScoreboard = () => {
    const hasScore = Boolean(scoreResult);
    const normalizedScore = Math.round(scoreResult?.score ?? 0);
    const isLocked = Boolean(scoreResult?.locked);
    const premiumAccess = scoreResult?.premiumAccess ?? null;
    const unlockOptions = scoreResult?.unlockOptions ?? null;
    const displayedFeedback =
      scoreResult?.feedback ?? scoreResult?.feedbackShort ?? t("scoreboard.fallbackFeedback");
    const singlePrice = unlockOptions?.single
      ? priceFormatter.format(unlockOptions.single.amountCents / 100)
      : priceFormatter.format(1);
    const subscriptionPrice = unlockOptions?.subscription
      ? priceFormatter.format(unlockOptions.subscription.amountCents / 100)
      : priceFormatter.format(9.9);
    const subscriptionValidUntil =
      premiumAccess?.validUntil && premiumAccess.validUntil.length > 0
        ? getDateFormatter(language).format(new Date(premiumAccess.validUntil))
        : null;
    const social = scoreResult?.socialLinks ?? SOCIAL_LINKS;
    const instagramUrl = social.instagramUrl;
    const linkedinUrl = social.linkedinUrl;
    const instagramHandle = social.instagramHandle;
    const resourcePrice = priceFormatter.format(15);
    const singleLoading = checkoutLoading === "single";
    const subscriptionLoading = checkoutLoading === "subscription";
    return (
      <div className="relative min-h-screen pb-24 text-white">
        <TopBar />
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 pt-24 text-center">
          {hasScore && viewport.width > 0 && viewport.height > 0 && (
            <Confetti width={viewport.width} height={viewport.height} numberOfPieces={220} recycle={false} />
          )}

          {!hasScore ? (
            <div className="glass-panel animate-section flex flex-col items-center gap-4 px-10 py-14 text-white/80">
              {scoreboardError ? (
                <>
                  <TriangleAlert className="h-10 w-10 text-rose-200" />
                  <p className="text-base text-rose-100">{scoreboardError}</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
                      onClick={() => {
                        logRiddleClient("Retrying scoreboard manually", { riddleId: riddle?.id });
                        void fetchScoreboard();
                      }}
                    >
                      {t("intro.retry")}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                      onClick={() => {
                        logRiddleClient("Closing scoreboard after error", { riddleId: riddle?.id });
                        setShowScoreboard(false);
                      }}
                    >
                      {t("scoreboard.backHome")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                  <p>{t("scoreboard.loading")}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="animate-section animate-delay-1 space-y-3">
                <span className="muted-label">{t("scoreboard.badge")}</span>
                <h1 className="text-4xl font-semibold text-white">{t("scoreboard.heading", { id: riddle?.id })}</h1>
                {scoreResult?.riddleTitle && (
                  <p className="text-base text-amber-100/80">{scoreResult.riddleTitle}</p>
                )}
              </div>

              <div className="elevated-card animate-section animate-delay-3 w-full space-y-8 p-10 text-left text-white/80">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/50">{t("scoreboard.scoreLabel")}</p>
                  <p className="text-5xl font-semibold text-white">{normalizedScore} / 100</p>
                  <p className="whitespace-pre-line text-base text-white/80">{displayedFeedback}</p>
                  {!isLocked && premiumAccess?.type && (
                    <p className="rounded-2xl border border-emerald-200/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">
                      {premiumAccess.type === "subscription"
                        ? subscriptionValidUntil
                          ? t("scoreboard.premiumActiveSubscription", { date: subscriptionValidUntil })
                          : t("scoreboard.premiumActiveSubscriptionNoDate")
                        : t("scoreboard.premiumActiveSingle")}
                    </p>
                  )}
                  {isLocked && scoreResult?.lockReason && (
                    <p className="rounded-2xl border border-amber-200/40 bg-amber-300/10 px-4 py-2 text-xs text-amber-100">
                      {scoreResult.lockReason}
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

                {isLocked ? (
                  <div className="rounded-2xl border border-amber-200/40 bg-amber-300/10 p-6 text-left text-white">
                    <p className="text-sm font-semibold text-white">{t("scoreboard.premiumTitle")}</p>
                    <p className="mt-2 text-sm text-white/80">{t("scoreboard.premiumSubtitle")}</p>
                    <div className="mt-5 flex flex-col gap-3 lg:flex-row">
                      <button
                        type="button"
                        className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/60"
                        onClick={() => handleCheckout("single")}
                        disabled={singleLoading || subscriptionLoading}
                      >
                        {singleLoading
                          ? t("scoreboard.premiumProcessing")
                          : t("scoreboard.premiumUnlockSingle", { price: singlePrice })}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-white/30 px-6 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleCheckout("subscription")}
                        disabled={singleLoading || subscriptionLoading}
                      >
                        {subscriptionLoading
                          ? t("scoreboard.premiumProcessing")
                          : t("scoreboard.premiumUnlockSubscription", { price: subscriptionPrice })}
                      </button>
                    </div>
                    {checkoutError && (
                      <p className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                        {checkoutError}
                      </p>
                    )}
                    <p className="mt-5 text-xs text-white/70">
                      {t("scoreboard.premiumResourcesLead", { price: resourcePrice })}{" "}
                      <Link href="/resources" className="font-semibold text-amber-200 hover:text-white">
                        {t("scoreboard.premiumResourcesCta")}
                      </Link>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200/30 bg-emerald-400/10 px-5 py-4 text-left text-sm text-emerald-100">
                    {premiumAccess?.type === "subscription"
                      ? subscriptionValidUntil
                        ? t("scoreboard.premiumActiveSubscription", { date: subscriptionValidUntil })
                        : t("scoreboard.premiumActiveSubscriptionNoDate")
                      : t("scoreboard.premiumActiveSingle")}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                  <p className="font-semibold uppercase tracking-[0.2em] text-white/60">
                    {t("scoreboard.socialTitle")}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-white/80 transition hover:text-white"
                    >
                      {t("scoreboard.socialInstagram", { handle: instagramHandle })}
                    </a>
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-white/80 transition hover:text-white"
                    >
                      {t("scoreboard.socialLinkedIn")}
                    </a>
                  </div>
                </div>

                {isLocked ? (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/70">
                    {t("scoreboard.premiumLockedHints")}
                  </div>
                ) : (
                  scoreResult?.hints &&
                  scoreResult.hints.length > 0 && (
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
                  )
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
                  {isLocked ? (
                    <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/70">
                      {t("scoreboard.premiumLockedQuestion")}
                    </p>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/80">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {scoreResult?.question?.trim()?.length
                          ? scoreResult.question
                          : language === "fr"
                            ? "L'énoncé détaillé sera bientôt disponible."
                            : "The full question will be available soon."}
                      </ReactMarkdown>
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <p className="muted-label">{t("scoreboard.solutionTitle")}</p>
                  {isLocked ? (
                    <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/70">
                      {t("scoreboard.premiumLockedSolution")}
                    </p>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/80">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {scoreResult?.officialAnswer?.trim()?.length
                          ? scoreResult.officialAnswer
                          : language === "fr"
                            ? "La solution détaillée arrive bientôt."
                            : "The detailed solution will appear soon."}
                      </ReactMarkdown>
                    </div>
                  )}
                </section>
              </div>

              <div className="flex flex-col items-center gap-4 text-sm text-white/70">
                <SupportApplePaySection t={t} language={language} />
                <button
                  type="button"
                  className="hover-lift rounded-full border border-amber-200/40 px-5 py-2 font-medium text-white transition hover:bg-amber-300/10"
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
      <main className="mx-auto mt-16 flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="animate-section animate-delay-1 space-y-4 text-center lg:text-left">
          <span className="muted-label">{t("riddle.stageLabel")}</span>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {riddle?.title ?? (language === "fr" ? "Énigme mystère" : "Mystery riddle")}
          </h1>
          <p className="text-base text-white/70">{t("riddle.heroTitle")}</p>
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

        {riddle?.imageURL ? (
          <div className="elevated-card animate-section animate-delay-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={riddle.imageURL} alt={t("riddle.heroTitle") ?? "Riddle illustration"} className="h-80 w-full object-cover" />
          </div>
        ) : (
          <div className="glass-panel animate-section animate-delay-2 flex h-80 items-center justify-center text-sm text-white/60">
            {language === "fr" ? "Illustration en cours de préparation…" : "Illustration loading soon…"}
          </div>
        )}

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="elevated-card animate-section animate-delay-3 space-y-8 p-10 text-left text-white/80">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.35em] text-white/50">
              <span>#{riddle?.id ?? 0}</span>
              <span>{difficultyLabel}</span>
            </div>
            <div className="glow-divider" />
            <div className="space-y-4">
              <p className="muted-label">{t("riddle.promptLabel")}</p>
              <div className="prose prose-invert max-w-none text-base leading-relaxed text-white/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{riddle?.question ?? ""}</ReactMarkdown>
              </div>
            </div>
            <div className="glow-divider" />
            <section className="space-y-4">
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
                  className="button-aurora hover-lift rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
                  onClick={handleSubmitAnswer}
                  disabled={submittingAnswer || Boolean(scoreResult)}
                >
                  {submittingAnswer ? t("riddle.submitLoading") : t("riddle.submit")}
                </button>
              </div>
            </section>
          </article>

          <aside className="flex flex-col gap-6">
            <div className="animate-section animate-delay-4">
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
            </div>

            <section className="glass-panel animate-section animate-delay-5 space-y-5 p-8 text-white/80">
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
                {revealedHints.map((index) => {
                  const label = t("riddle.hintLabel", { index: index + 1 });
                  return (
                    <div key={`hint-${index}`} className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white/80">
                      <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/50">{label}</span>
                      <p className="mt-2 text-sm leading-relaxed">{hints[index]}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );

  if (loading) return renderLoading();
  if (error || !riddle) return renderError();
  if (scoreboardShouldDisplay) return renderScoreboard();
  return renderRiddle();
}
