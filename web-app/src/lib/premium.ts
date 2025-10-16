export const PREMIUM_PRICES = {
  single: {
    amountCents: 100,
    currency: "eur",
    name: {
      en: "Detailed feedback for today\u2019s riddle",
      fr: "Retour détaillé pour l\u2019énigme du jour",
    },
    description: {
      en: "Unlock the full explanation and hints for the current puzzle.",
      fr: "Débloque l\u2019explication complète et tous les indices pour cette énigme.",
    },
  },
  subscription: {
    amountCents: 990,
    currency: "eur",
    name: {
      en: "Enigmate Premium Monthly",
      fr: "Enigmate Premium Mensuel",
    },
    description: {
      en: "Unlimited detailed feedback and answers for every riddle this month.",
      fr: "Feedback et solutions détaillés illimités sur toutes les énigmes du mois.",
    },
  },
} as const;

export type ResourceSlug = "ai-riddle-course" | "enigmate-blueprint";

export type ResourceDefinition = {
  slug: ResourceSlug;
  amountCents: number;
  currency: "eur";
  name: string;
  headline: string;
  description: string;
  benefits: string[];
  downloadPath: string;
};

export const RESOURCE_CATALOG: Record<ResourceSlug, ResourceDefinition> = {
  "ai-riddle-course": {
    slug: "ai-riddle-course",
    amountCents: 1500,
    currency: "eur",
    name: "Pack PDF \u2013 Maîtriser les énigmes IA",
    headline: "15\u20ac pour une formation PDF complète afin de coacher ton cerveau.",
    description: "Programmes d\u2019entraînement, méthodes de résolution, frameworks et exercices avancés pour booster ta logique.",
    benefits: [
      "Méthodes pas-à-pas pour casser les énigmes les plus difficiles.",
      "Exercices quotidiens, templates et checklist prêtes à imprimer.",
      "Stratégies d\u2019IA pour entraîner ton raisonnement et gagner en vitesse.",
    ],
    downloadPath: "/resources/ai-riddle-course.pdf",
  },
  "enigmate-blueprint": {
    slug: "enigmate-blueprint",
    amountCents: 1500,
    currency: "eur",
    name: "Blueprint Enigmate (Dev & IA)",
    headline: "15\u20ac pour un retour d\u2019expérience complet sur la construction d\u2019Enigmate.",
    description: "Architecture, Supabase, Next.js, prompts d\u2019IA\u2026 nous détaillons notre stack et nos choix techniques.",
    benefits: [
      "Schémas d\u2019architecture, flux API et sécurité Supabase.",
      "Playbook d\u2019intégration Stripe et bonnes pratiques Next.js.",
      "Checklist de déploiement et monitoring pour scaler sereinement.",
    ],
    downloadPath: "/resources/enigmate-blueprint.pdf",
  },
};

export const SOCIAL_LINKS = {
  instagramHandle: "@just2entrepreneurs",
  instagramUrl: "https://www.instagram.com/just2entrepreneurs",
  linkedinUrl: "https://www.linkedin.com/in/arthur-rich%C3%A9-7a277719a/",
} as const;
