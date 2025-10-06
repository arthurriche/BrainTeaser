"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "fr";

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
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  translate: (key: string, params?: Record<string, unknown>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const TRANSLATIONS: Record<Language, TranslationTree> = {
  en: {
    nav: {
      tagline: "Sharpen your mind daily",
      languageToggle: "Switch to French",
      logout: "Log out",
    },
    intro: {
      badge: "Today's brain teaser",
      heroTitle: "Ready to focus?",
      heroHighlight: "Solve one brain teaser in about 45 minutes.",
      heroDescription:
        "Take a calm moment, read the brief overview, then launch the challenge when you feel prepared.",
      primaryCta: "Start the brain teaser",
      retry: "Refresh",
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
      title: "Summoning today's enigma…",
      subtitle: "Hold tight, the Master is arranging the puzzle.",
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
      confidence: (params) => `Master's confidence: ${getNumberParam(params, "value")}%`,
      loading: "Computing the ranking…",
      support: "Support via Apple Pay (€0.30)",
      backHome: "Back to home",
      questionTitle: "Question",
      solutionTitle: "Official solution",
    },
    scoreboardErrors: {
      generic: "Unable to retrieve the leaderboard.",
      auth: "Sign in to view the leaderboard.",
      none: "No score recorded yet.",
    },
    riddle: {
      stageLabel: "Resolution stage",
      heroTitle: "Focus on the solution",
      puzzleNumber: (params) => `Puzzle #${getNumberParam(params, "id") || "?"}`,
      difficulty: (params) => getStringParam(params, "label"),
      releaseDate: (params) => `Published ${getStringParam(params, "date")}`,
      targetTime: (params) => `Target time: ${getNumberParam(params, "minutes")} min`,
      promptLabel: "Prompt",
      answerLabel: "Your answer",
      answerPlaceholder: "Describe your reasoning and final answer.",
      status: {
        timeRemaining: "Time left",
        hintsUsed: "Hints used",
      },
      hintSectionTitle: "Hints",
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
  fr: {
    nav: {
      tagline: "Aiguise ton esprit chaque jour",
      languageToggle: "Switch to English",
      logout: "Se déconnecter",
    },
    intro: {
      badge: "Brain teaser du jour",
      heroTitle: "Prêt à te concentrer ?",
      heroHighlight: "Résous un brain teaser en 45 minutes environ.",
      heroDescription:
        "Prends un moment de calme, découvre le contexte, puis lance le défi quand tu es prêt.",
      primaryCta: "Commencer le brain teaser",
      retry: "Actualiser",
      info: {
        durationLabel: "Durée recommandée",
        progressionLabel: "Énigme",
        dateLabel: "Publié",
      },
      imagePlaceholder: "L'illustration se dévoile au lancement.",
      lockedTitle: "L'énoncé est masqué",
      lockedDescription:
        "Tu verras la question complète et l'image dès que tu cliqueras sur “Commencer le brain teaser”.",
      emptyTitle: "Aucune énigme disponible",
      emptyDescription: "Reviens demain pour poursuivre le duel.",
    },
    loading: {
      title: "Un brainteaser de kiffeur est en train de charger",
      subtitle: "Le Maître dispose les pièces, un instant.",
    },
    error: {
      title: "Impossible de charger l'énigme",
      subtitle: "Réessaie dans un instant.",
      cta: "Réessayer",
    },
    scoreboard: {
      badge: "Classement",
      heading: (params) => `Résultats de l'énigme n°${getNumberParam(params, "id") || "?"}`,
      scoreLabel: "Score",
      fallbackFeedback: "Ta tentative est enregistrée. Reviens demain pour une nouvelle énigme.",
      outrankLabel: "Tu surpasses",
      percentSuffix: "% des challengers",
      players: (params) => {
        const beaten = getNumberParam(params, "beaten");
        const total = getNumberParam(params, "total");
        return total > 0 ? `${beaten} joueurs sur ${total}` : "Pas encore de comparaison disponible";
      },
      timeUsed: "Temps écoulé",
      hintsUsed: "Indices utilisés",
      hintListTitle: "Indices à retenir",
      missingTitle: "Points à affiner",
      confidence: (params) => `Confiance du Maître : ${getNumberParam(params, "value")}%`,
      loading: "Calcul du classement…",
      support: "Soutenir via Apple Pay (0,30 €)",
      backHome: "Retour à l'accueil",
      questionTitle: "Énoncé",
      solutionTitle: "Solution détaillée",
    },
    scoreboardErrors: {
      generic: "Impossible de récupérer le classement.",
      auth: "Connecte-toi pour accéder au classement.",
      none: "Aucun score enregistré pour l'instant.",
    },
    riddle: {
      stageLabel: "Étape de résolution",
      heroTitle: "Concentre-toi sur la solution",
      puzzleNumber: (params) => `Énigme n°${getNumberParam(params, "id") || "?"}`,
      difficulty: (params) => getStringParam(params, "label"),
      releaseDate: (params) => `Publié le ${getStringParam(params, "date")}`,
      targetTime: (params) => `Durée cible : ${getNumberParam(params, "minutes")} min`,
      promptLabel: "Énoncé",
      answerLabel: "Ta réponse",
      answerPlaceholder: "Décris ton raisonnement complet et ta proposition finale.",
      status: {
        timeRemaining: "Temps restant",
        hintsUsed: "Indices utilisés",
      },
      hintSectionTitle: "Indices",
      hintReveal: (params) => `Révéler l'indice ${getNumberParam(params, "next")}`,
      hintReminder: "Utilise les indices avec parcimonie : chacun réduit ton score final.",
      submit: "Valider ma réponse",
      submitLoading: "Validation…",
      support: "Soutenir via Apple Pay (0,30 €)",
      backHome: "Retour à l'accueil",
    },
    timer: {
      label: "Chronomètre",
      finished: "Terminé",
      critical: "Temps critique",
      running: "En cours",
      idle: "Initialisation",
      helper: "Le chrono démarre automatiquement : reste concentré jusqu'à la résolution.",
    },
    modals: {
      authRequired: "Connecte-toi pour enregistrer ta tentative.",
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
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("enigmate-language") as Language | null;
    if (stored === "en" || stored === "fr") {
      setLanguage(stored);
    } else {
      const browser = window.navigator.language.startsWith("fr") ? "fr" : "en";
      setLanguage(browser);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("enigmate-language", language);
    document.documentElement.lang = language;
  }, [language]);

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

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "en" ? "fr" : "en"));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage, translate }),
    [language, toggleLanguage, translate],
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
