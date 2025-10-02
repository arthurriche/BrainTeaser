
"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useTranslations } from "@/components/providers/LanguageProvider";
import { TopBar } from "@/components/layout/TopBar";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type AuthMode = "signIn" | "signUp";

export const AuthView = () => {
  const { supabase } = useSupabase();
  const { language } = useTranslations();

  const copy = useMemo(() => {
    if (language === "fr") {
      return {
        badge: "Programme quotidien",
        heroTitle: "Enigmate",
        heroHighlight: "Deviens plus affûté chaque jour",
        heroDescription:
          "Une énigme par jour, des statistiques précises et un Maître toujours prêt à challenger ta logique.",
        benefits: [
          "🎯 Difficulté adaptée de novice à grand maître",
          "🧠 Analyse, discute avec Le Maître et mesure tes progrès",
        ],
        signInTab: "Connexion",
        signUpTab: "Inscription",
        linkedin: "Continuer avec LinkedIn",
        emailLabel: "Email",
        emailPlaceholder: "prenom.nom@email.com",
        fullNameLabel: "Nom complet",
        fullNamePlaceholder: "Jeanne Dupont",
        passwordLabel: "Mot de passe",
        passwordPlaceholder: "••••••••",
        submitSignIn: "Se connecter",
        submitSignUp: "Créer mon compte",
        submitting: "Patiente...",
        forgotPassword: "Mot de passe oublié ?",
        invalidEmail: "Veuillez saisir une adresse email valide.",
        weakPassword: "Le mot de passe doit contenir au moins 6 caractères.",
        linkedinError: "Impossible de lancer la connexion LinkedIn.",
        genericError: "Une erreur est survenue. Veuillez réessayer.",
        verificationEmail: (email: string) =>
          `Un email de validation a été envoyé à ${email}. Vérifie ta boîte de réception pour finaliser la création.`,
        resetInfo: (email: string) =>
          `Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé.`,
        resetError: "Impossible d’envoyer l’email de réinitialisation.",
        resetButton: "Envoyer un lien de réinitialisation",
      };
    }
    return {
      badge: "Daily ritual",
      heroTitle: "Enigmate",
      heroHighlight: "Sharpen your thinking every single day",
      heroDescription:
        "One handcrafted riddle per day, precise scoring, and the Master ready to push your reasoning further.",
      benefits: [
        "🎯 Difficulty adapts from novice to grandmaster",
        "🧠 Analyse, debate with the Master, and track your evolution",
      ],
      signInTab: "Sign in",
      signUpTab: "Create account",
      linkedin: "Continue with LinkedIn",
      emailLabel: "Email",
      emailPlaceholder: "alex.morgan@email.com",
      fullNameLabel: "Full name",
      fullNamePlaceholder: "Alex Morgan",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      submitSignIn: "Sign in",
      submitSignUp: "Create account",
      submitting: "Please wait…",
      forgotPassword: "Forgot password?",
      invalidEmail: "Please provide a valid email address.",
      weakPassword: "Password must be at least 6 characters long.",
      linkedinError: "LinkedIn sign-in could not start.",
      genericError: "Something went wrong. Please try again.",
      verificationEmail: (email: string) =>
        `A verification email was sent to ${email}. Check your inbox to complete registration.`,
      resetInfo: (email: string) =>
        `If an account exists for ${email}, a reset link is on its way.`,
      resetError: "We could not send the reset email.",
      resetButton: "Send reset link",
    };
  }, [language]);

  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidEmail = EMAIL_REGEX.test(email.trim());
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (authMode === "signIn" || fullName.trim().length > 1);

  const clearMessages = () => {
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleSignInOrSignUp = async () => {
    if (!isValidEmail) {
      setErrorMessage(copy.invalidEmail);
      return;
    }

    if (password.length < 6) {
      setErrorMessage(copy.weakPassword);
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      if (authMode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setInfoMessage(copy.verificationEmail(email));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copy.genericError,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInSignIn = async () => {
    clearMessages();
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "linkedin_oidc",
        options: {
          redirectTo,
          scopes: "openid profile email",
        },
      });
      if (error) throw error;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copy.linkedinError,
      );
    }
  };

  const handleResetPassword = async () => {
    if (!isValidEmail) {
      setErrorMessage(copy.invalidEmail);
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth/password-reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      setInfoMessage(copy.resetInfo(email));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copy.resetError,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-24 text-white">
      <TopBar />
      <div className="mx-auto mt-16 flex w-full max-w-6xl flex-col gap-12 px-6 lg:flex-row">
        <article className="elevated-card flex-1 space-y-8 p-10 text-white/85">
          <span className="muted-label text-white/50">{copy.badge}</span>
          <h1 className="text-4xl font-semibold text-white">
            {copy.heroTitle}
            <span className="block bg-gradient-to-r from-white via-primary to-accent bg-clip-text text-transparent">
              {copy.heroHighlight}
            </span>
          </h1>
          <p className="text-base text-white/70">{copy.heroDescription}</p>
          <div className="space-y-3 text-sm text-white/70">
            {copy.benefits.map((benefit) => (
              <div key={benefit} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {benefit}
              </div>
            ))}
          </div>
        </article>

        <section className="glass-panel flex-1 space-y-8 p-10">
          <div className="flex gap-2 rounded-full bg-white/10 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signIn");
                clearMessages();
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                authMode === "signIn" ? "bg-white text-background shadow-sm" : "text-white/60"
              }`}
            >
              {copy.signInTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signUp");
                clearMessages();
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                authMode === "signUp" ? "bg-white text-background shadow-sm" : "text-white/60"
              }`}
            >
              {copy.signUpTab}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLinkedInSignIn}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#0A66C2] bg-[#0A66C2] font-semibold text-white transition hover:border-[#094d92] hover:bg-[#094d92]"
          >
            {copy.linkedin}
          </button>

          <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="email">
                {copy.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/5"
                placeholder={copy.emailPlaceholder}
              />
            </div>

            {authMode === "signUp" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="fullName">
                  {copy.fullNameLabel}
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/5"
                  placeholder={copy.fullNamePlaceholder}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="password">
                {copy.passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={authMode === "signUp" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/5"
                placeholder={copy.passwordPlaceholder}
              />
            </div>

            <button
              type="button"
              onClick={handleSignInOrSignUp}
              disabled={!canSubmit || loading}
              className="mt-2 flex h-12 items-center justify-center rounded-xl bg-white/80 font-semibold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white/50"
            >
              {loading ? (
                <span className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.submitting}
                </span>
              ) : authMode === "signIn" ? (
                copy.submitSignIn
              ) : (
                copy.submitSignUp
              )}
            </button>

            <button
              type="button"
              onClick={handleResetPassword}
              className="text-sm font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              {copy.forgotPassword}
            </button>
          </div>

          {(errorMessage || infoMessage) && (
            <p
              className={`rounded-xl border px-4 py-3 text-sm ${
                errorMessage
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {errorMessage ?? infoMessage}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
