
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

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const getStripeConstructor = (): typeof window.Stripe | null => {
  if (typeof window === "undefined") return null;
  return typeof window.Stripe === "function" ? window.Stripe : null;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read blob"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });


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
  voiceTranscription?: string | null;
  photoTranscription?: string | null;
  attachments?: {
    audio: boolean;
    photo: boolean;
  } | null;
  autoSubmitted?: boolean;
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Novice",
  2: "Skilled",
  3: "Expert",
  4: "Grandmaster",
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
  voiceTranscription: overrides.voiceTranscription ?? base?.voiceTranscription ?? null,
  photoTranscription: overrides.photoTranscription ?? base?.photoTranscription ?? null,
  attachments: overrides.attachments ?? base?.attachments ?? null,
  autoSubmitted: overrides.autoSubmitted ?? base?.autoSubmitted ?? false,
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

const getDateFormatter = () =>
  new Intl.DateTimeFormat("en-US", {
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

const SupportApplePaySection = ({ t }: { t: TranslateFn }) => {
  const [amountCents, setAmountCents] = useState(DEFAULT_DONATION_CENTS);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<StripePaymentRequest | null>(null);
  const [canUseApplePay, setCanUseApplePay] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);

  const formattedAmount = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(amountCents / 100),
    [amountCents],
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
      if (cancelled) return;
      const stripeCtor = getStripeConstructor();
      if (!stripeCtor) return;
      try {
        const instance = stripeCtor(STRIPE_PUBLISHABLE_KEY);
        setStripe(instance);
      } catch (error) {
        console.error("[SupportApplePay] Failed to initialise Stripe", error);
        setErrorMessage(scriptError);
        setStatus("error");
      }
    };

    if (getStripeConstructor()) {
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
            locale: "en",
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
  }, [paymentRequest, stripe, amountCents, genericError]);

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
  const { t } = useTranslations();
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioState, setAudioState] = useState<"idle" | "recording" | "processing" | "review">("idle");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const autoSubmitRef = useRef(false);
  const pendingAutoSubmitRef = useRef(false);

  const clearAudioResources = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    mediaStreamRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const clearAudioRecording = useCallback(() => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    setAudioDataUrl(null);
    setAudioError(null);
    setAudioState("idle");
  }, [audioPreviewUrl]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (audioState === "recording") {
      stopRecording();
      return;
    }
    if (audioState === "processing") return;
    if (audioState === "review" || audioState === "idle") {
      clearAudioRecording();
    }
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        console.error("[Audio] Recorder error", event);
        setAudioError("Recording failed. Please try again.");
        clearAudioResources();
        setAudioState("idle");
      };
      recorder.onstop = async () => {
        setAudioState("processing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const [dataUrl, objectUrl] = await Promise.all([blobToDataUrl(blob), Promise.resolve(URL.createObjectURL(blob))]);
          setAudioDataUrl(dataUrl);
          if (audioPreviewUrl) {
            URL.revokeObjectURL(audioPreviewUrl);
          }
          setAudioPreviewUrl(objectUrl);
          setAudioState("review");
        } catch (error) {
          console.error("[Audio] Failed to process recording", error);
          setAudioError("Unable to process the recording. Please try again.");
          setAudioDataUrl(null);
          setAudioPreviewUrl(null);
          setAudioState("idle");
        } finally {
          clearAudioResources();
        }
      };
      recorder.start();
      setAudioState("recording");
    } catch (error) {
      console.error("[Audio] Failed to access microphone", error);
      setAudioError("Microphone access denied. Please allow access and try again.");
      clearAudioResources();
      setAudioState("idle");
    }
  }, [audioPreviewUrl, audioState, clearAudioRecording, clearAudioResources, stopRecording]);

  const handlePhotoUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      const objectUrl = URL.createObjectURL(file);
      setPhotoPreviewUrl(objectUrl);
      setPhotoDataUrl(dataUrl);
    } catch (error) {
      console.error("[Photo] Failed to read file", error);
      setPhotoError("Unable to read that image. Please try another photo.");
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setPhotoPreviewUrl(null);
      setPhotoDataUrl(null);
    }
  }, [photoPreviewUrl]);

  const clearPhoto = useCallback(() => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl(null);
    setPhotoDataUrl(null);
    setPhotoError(null);
  }, [photoPreviewUrl]);

  useEffect(() => {
    return () => {
      clearAudioResources();
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [audioPreviewUrl, photoPreviewUrl, clearAudioResources]);

  const viewport = useViewportSize();

  const [countdownState, countdownControls] = useCountdown();
  const { start, pause, reset } = countdownControls;

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }),
    [],
  );

  const loadRiddle = useCallback(async () => {
    setLoading(true);
    setError(null);
    reset();
    try {
      logRiddleClient("Loading daily riddle");
      const response = await fetch(`/api/riddle-today?lang=en`, { cache: "no-store" });
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
      clearAudioRecording();
      clearPhoto();
      start(payload.duration ?? DEFAULT_DURATION);
    } catch (err) {
      logRiddleClient("Error while loading riddle", err);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [start, reset, clearAudioRecording, clearPhoto]);

  useEffect(() => {
    void loadRiddle();
  }, [loadRiddle]);

  const difficultyLabel = useMemo(() => {
    if (!riddle?.difficulty) return "To confirm";
    return DIFFICULTY_LABELS[riddle.difficulty] ?? "To confirm";
  }, [riddle?.difficulty]);

  const releaseDateLabel = useMemo(() => {
    if (!riddle?.releaseDate) return null;
    const date = new Date(riddle.releaseDate);
    if (Number.isNaN(date.getTime())) return null;
    return getDateFormatter().format(date);
  }, [riddle?.releaseDate]);

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
              ? { kind: "single_riddle", riddleId: riddle?.id, locale: "en" }
              : { kind: "subscription", locale: "en" },
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
    [riddle?.id, t],
  );

  const handleSubmitAnswer = useCallback(
    async (options?: { allowEmpty?: boolean; auto?: boolean }) => {
      if (!riddle || submittingAnswer || scoreResult) return;

      const trimmedAnswer = userAnswer.trim();
      const hasText = trimmedAnswer.length > 0;
      const hasAudio = Boolean(audioDataUrl);
      const hasPhoto = Boolean(photoDataUrl);

      if (!options?.allowEmpty && !hasText && !hasAudio && !hasPhoto) return;

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
          hasAudio,
          hasPhoto,
          autoSubmitted: options?.auto ?? false,
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
            attachments: {
              audio: audioDataUrl,
              photo: photoDataUrl,
            },
            autoSubmitted: options?.auto ?? false,
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
          autoSubmitted: options?.auto ?? false,
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
    },
    [
      riddle,
      submittingAnswer,
      scoreResult,
      userAnswer,
      audioDataUrl,
      photoDataUrl,
      countdownState.totalDuration,
      countdownState.timeRemaining,
      revealedHints,
      hints,
      pause,
      t,
    ],
  );

  const fetchScoreboard = useCallback(async () => {
    if (!riddle) return;
    logRiddleClient("Fetching scoreboard", { riddleId: riddle.id });
    setScoreboardError(null);
    try {
      const response = await fetch(`/api/riddle-scoreboard?riddleId=${riddle.id}&lang=en`, { cache: "no-store", credentials: "include" });
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
  }, [riddle, scoreResult, hints, revealedHints, t]);

  useEffect(() => {
    if (countdownState.timeRemaining === 0) {
      if (!scoreResult && !submittingAnswer && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        if (audioState === "recording" || audioState === "processing") {
          pendingAutoSubmitRef.current = true;
          if (audioState === "recording") {
            stopRecording();
          }
        } else {
          logRiddleClient("Timer reached zero, auto-submitting answer");
          void handleSubmitAnswer({ allowEmpty: true, auto: true });
        }
      }
    } else {
      autoSubmitRef.current = false;
      pendingAutoSubmitRef.current = false;
    }
  }, [audioState, countdownState.timeRemaining, handleSubmitAnswer, scoreResult, stopRecording, submittingAnswer]);

  useEffect(() => {
    if (
      autoSubmitRef.current &&
      pendingAutoSubmitRef.current &&
      audioState !== "recording" &&
      audioState !== "processing" &&
      !submittingAnswer &&
      !scoreResult
    ) {
      pendingAutoSubmitRef.current = false;
      logRiddleClient("Recording processed after timeout, completing auto submission");
      void handleSubmitAnswer({ allowEmpty: true, auto: true });
    }
  }, [audioState, handleSubmitAnswer, scoreResult, submittingAnswer]);

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
        ? getDateFormatter().format(new Date(premiumAccess.validUntil))
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
                  {scoreResult?.autoSubmitted && (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Submitted automatically at timeout</p>
                  )}
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
                  {scoreResult?.voiceTranscription && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Voice transcription</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{scoreResult.voiceTranscription}</p>
                    </div>
                  )}
                  {scoreResult?.photoTranscription && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Handwritten notes</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{scoreResult.photoTranscription}</p>
                    </div>
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
                            <span className="font-semibold text-white/80">{`Hint ${index + 1}:`}</span> {hint}
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
                          : "The detailed solution will appear soon."}
                      </ReactMarkdown>
                    </div>
                  )}
                </section>
              </div>

              <div className="flex flex-col items-center gap-4 text-sm text-white/70">
                <SupportApplePaySection t={t} />
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
            {riddle?.title ?? "Mystery riddle"}
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
            Illustration loading soon…
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
              <p className="text-xs text-white/60">
                You can reply in any language—just make sure your reasoning is explicit so every point can be awarded.
              </p>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Voice response (optional)</p>
                    <p className="text-xs text-white/60">
                      Record your explanation instead of typing. We will transcribe and analyse it automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      audioState === "recording"
                        ? "bg-rose-500/90 text-white shadow-lg"
                        : "border border-white/30 bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                    onClick={startRecording}
                    disabled={submittingAnswer || Boolean(scoreResult)}
                  >
                    {audioState === "recording" ? "Stop recording" : audioState === "review" ? "Record again" : "Record audio"}
                  </button>
                </header>
                <div className="space-y-2 text-xs text-white/70">
                  {audioState === "recording" && <p className="animate-pulse text-rose-200">Recording… speak clearly.</p>}
                  {audioState === "processing" && <p>Processing your clip…</p>}
                  {audioState === "review" && audioPreviewUrl && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                      <audio controls src={audioPreviewUrl} className="w-full">
                        <track kind="captions" />
                      </audio>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-200 hover:text-rose-100"
                        onClick={clearAudioRecording}
                        disabled={submittingAnswer || Boolean(scoreResult)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {audioError && <p className="text-rose-200">{audioError}</p>}
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Photo evidence (optional)</p>
                    <p className="text-xs text-white/60">Upload a snapshot of handwritten reasoning to be analysed.</p>
                  </div>
                  <label className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/20">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={submittingAnswer || Boolean(scoreResult)}
                    />
                  </label>
                </header>
                {photoPreviewUrl && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Uploaded reasoning" className="max-h-48 w-full rounded-lg object-contain" />
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-rose-200 hover:text-rose-100"
                      onClick={clearPhoto}
                      disabled={submittingAnswer || Boolean(scoreResult)}
                    >
                      Remove photo
                    </button>
                  </div>
                )}
                {photoError && <p className="text-xs text-rose-200">{photoError}</p>}
              </div>
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
