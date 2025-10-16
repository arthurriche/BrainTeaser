"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

type Language = "en";

type TranslationEntry = string | ((params?: Record<string, unknown>) => string);
type TranslationTree = { [key: string]: TranslationEntry | TranslationTree };

const getNumberParam = (params: Record<string, unknown> | undefined, key: string, fallback = 0) => {
  const value = params?.[key];
  return typeof value === "number" ? value : fallback;
};

const getStringParam = (params: Record<string, unknown> | undefined, key: string, fallback = "") => {
  const value = params?.[key];
  return typeof value === "string" ? value : fallback;
};

type LanguageContextValue = {
  language: Language;
  translate: (key: string, params?: Record<string, unknown>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const TRANSLATIONS: Record<Language, TranslationTree> = {
  en: {
    nav: {
      tagline: "Sharpen your mind daily",
      resources: "Resources",
      logout: "Log out",
    },
    intro: {
      badge: "Today's brain teaser",
      heroTitle: "Ready to focus?",
      heroHighlight: (params) => `Solve one brain teaser in about ${getNumberParam(params, "minutes") || "??"} minutes.`,
      heroDescription:
        "Take a calm moment, read the brief overview, then launch the challenge when you feel prepared.",
      primaryCta: "Start the brain teaser",
      retry: "Refresh",
      loading: "Loading up—stay sharp",
      info: {
        durationLabel: "Recommended duration",
        progressionLabel: "Puzzle",
        dateLabel: "Published",
      },
      imagePlaceholder: "Picture will unlock once you start.",
      lockedTitle: "The statement is hidden",
      lockedDescription:
        "You will see the full question and visual as soon as you press “Start the brain teaser”.",
      emptyTitle: "No puzzle available",
      emptyDescription: "Return tomorrow for the next duel.",
    },
    loading: {
      title: "This riddle is seriously tough…",
      subtitle: "Crack it and you're the GOAT.",
    },
    error: {
      title: "We couldn't load the puzzle",
      subtitle: "Please try again in a moment.",
      cta: "Try again",
    },
    scoreboard: {
      badge: "Ranking",
      heading: (params) => `Puzzle #${getNumberParam(params, "id") || "?"} results`,
      scoreLabel: "Score",
      fallbackFeedback: "Your run is recorded. Come back tomorrow for a fresh riddle.",
      outrankLabel: "You outrank",
      percentSuffix: "% of challengers",
      players: (params) => {
        const beaten = getNumberParam(params, "beaten");
        const total = getNumberParam(params, "total");
        return total > 0 ? `${beaten} of ${total} players` : "No comparison yet";
      },
      timeUsed: "Time used",
      hintsUsed: "Hints spent",
      hintListTitle: "Hints to revisit",
      missingTitle: "Sharpen these points",
      confidence: (params) => `Evaluator confidence: ${getNumberParam(params, "value")}%`,
      loading: "Computing the ranking…",
      backHome: "Back to home",
      questionTitle: "Question",
      solutionTitle: "Official solution",
      supportTitle: "Support the challenge",
      supportSubtitle: "Help keep daily riddles coming with a small tip.",
      supportAmountLabel: "Choose your contribution",
      supportTotalLabel: "Enigmate support",
      supportConfigure: "Configure Stripe keys to enable Apple Pay donations.",
      supportUnavailable: "Apple Pay isn't available on this device. Try Safari on an Apple Pay enabled device.",
      supportProcessing: "Processing your Apple Pay donation…",
      supportSuccess: (params) => {
        const amount = params && typeof params === "object" ? (params as { amount?: unknown }).amount : undefined;
        return `Thanks! ${typeof amount === "string" ? amount : "€0.30"} pledged.`;
      },
      supportErrorGeneric: "Unable to complete the donation.",
      supportScriptError: "Stripe.js could not be loaded. Check your network or configuration.",
      premiumTitle: "Unlock detailed feedback",
      premiumSubtitle: "Choose how you want to access the complete explanation.",
      premiumUnlockSingle: (params) => `Unlock this riddle for ${getStringParam(params, "price", "€1.00")}`,
      premiumUnlockSubscription: (params) => `Full month access for ${getStringParam(params, "price", "€9.90")}/month`,
      premiumProcessing: "Redirecting to secure checkout…",
      premiumResourcesLead: (params) => `Want more? Grab the PDF strategy packs for ${getStringParam(params, "price", "€15.00")}.`,
      premiumResourcesCta: "Browse the resources",
      premiumLockedHints: "Unlock premium to reveal every hint and detailed breakdown.",
      premiumLockedQuestion: "Unlock premium access to read the full statement and context.",
      premiumLockedSolution: "Unlock premium access to uncover the official solution and commentary.",
      premiumActiveSubscription: (params) => `Premium active – access guaranteed until ${getStringParam(params, "date", "soon")}.`,
      premiumActiveSubscriptionNoDate: "Premium active – all detailed breakdowns unlocked.",
      premiumActiveSingle: "Detailed insights unlocked for this riddle.",
      socialTitle: "Stay connected",
      socialInstagram: (params) => `Instagram · ${getStringParam(params, "handle", "@just2entrepreneurs")}`,
      socialLinkedIn: "LinkedIn · Arthur Riché",
      premiumErrorUnavailable: "Checkout is unavailable right now. Reload and try again.",
      premiumErrorGeneric: "Unable to start the checkout. Please try again.",
    },
    scoreboardErrors: {
      generic: "Unable to retrieve the leaderboard.",
      auth: "Sign in to view the leaderboard.",
      none: "No score recorded yet.",
    },
    resources: {
      title: "Premium resources",
      subtitle: "Download our PDF courses to go deeper with Enigmate.",
      highlightSuccess: "Checkout confirmed! Your premium pack is ready.",
      purchaseCta: (params) => `Buy for ${getStringParam(params, "price", "€15.00")}`,
      processing: "Redirecting to checkout…",
      download: "Download the PDF",
      ownedBadge: "Unlocked",
      error: "We couldn't start the checkout. Please try again.",
      listTitle: "What you'll find inside",
      followTitle: "Stay connected",
      followInstagram: (params) => `Instagram · ${getStringParam(params, "handle", "@just2entrepreneurs")}`,
      followLinkedIn: "LinkedIn · Arthur Riché",
    },
    payments: {
      successTitle: "Payment confirmed",
      successSubtitle: "Access unlocked — enjoy the full experience.",
      successSingle: (params) => `Detailed feedback unlocked for ${getStringParam(params, "price", "€1.00")}.`,
      successSubscription: (params) => `Monthly premium activated for ${getStringParam(params, "price", "€9.90")} – access until ${getStringParam(params, "date", "the end of the cycle")}.`,
      successSubscriptionNoDate: "the end of the cycle",
      successResource: (params) => `Resource unlocked for ${getStringParam(params, "price", "€15.00")}.`,
      loadingTitle: "Confirming your payment",
      loadingSubtitle: "Hold tight while we secure your access.",
      errorTitle: "Payment verification failed",
      errorGeneric: "We couldn't confirm your payment. Please contact support if it continues.",
      errorMissing: "Missing payment reference. Return to the app and try again.",
      downloadResource: "Download your PDF",
      returnButton: "Back to Enigmate",
      cancelledTitle: "Payment cancelled",
      cancelledSubtitle: "No charge was made. You can restart the checkout whenever you're ready.",
      cancelledRetry: "Explore the resources again",
    },
    riddle: {
      stageLabel: "Riddle",
      heroTitle: "Focus on the solution",
      puzzleNumber: (params) => `Puzzle #${getNumberParam(params, "id") || "?"}`,
      difficulty: (params) => getStringParam(params, "label"),
      releaseDate: (params) => `Published ${getStringParam(params, "date")}`,
      targetTime: (params) => `Target time: ${getNumberParam(params, "minutes")} min`,
      promptLabel: "Prompt",
      answerLabel: "Your answer",
      answerPlaceholder: "Explain your full reasoning and final answer. You may respond in any language—just keep the logic explicit to earn every point.",
      status: {
        timeRemaining: "Time left",
        hintsUsed: "Hints used",
      },
      hintSectionTitle: "Hints",
      hintLabel: (params) => `Hint ${getNumberParam(params, "index")}`,
      hintReveal: (params) => `Reveal hint ${getNumberParam(params, "next")}`,
      hintReminder: "Use hints sparingly—each one lowers your final score.",
      submit: "Submit my answer",
      submitLoading: "Submitting…",
      support: "Support via Apple Pay (€0.30)",
      backHome: "Back to home",
    },
    timer: {
      label: "Focus timer",
      finished: "Completed",
      critical: "Critical time",
      running: "In progress",
      idle: "Initialising",
      helper: "The timer starts automatically—stay focused until you crack the riddle.",
    },
    modals: {
      authRequired: "Sign in to record your run.",
    },
  },
};

const getNestedValue = (tree: TranslationTree, segments: string[]): TranslationEntry | undefined => {
  let current: TranslationEntry | TranslationTree | undefined = tree;
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = current[segment];
    } else {
      current = undefined;
      break;
    }
  }
  return typeof current === "function" || typeof current === "string" ? current : undefined;
};

const formatString = (template: string, params?: Record<string, unknown>) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const language: Language = "en";
  if (typeof document !== "undefined") {
    document.documentElement.lang = "en";
  }
  const translate = useCallback(
    (key: string, params?: Record<string, unknown>) => {
      const segments = key.split(".");
      const entry = getNestedValue(TRANSLATIONS[language], segments);
      if (!entry) return key;
      if (typeof entry === "function") {
        return String(entry(params));
      }
      return formatString(entry, params);
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, translate }),
    [translate],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const useTranslations = () => {
  const { translate, language } = useLanguage();
  return { t: translate, language };
};
