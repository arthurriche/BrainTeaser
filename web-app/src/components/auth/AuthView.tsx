
"use client";

import Image from "next/image";
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
        heroTitle: "Enigmate",
        heroTagline: "Deviens plus affûté chaque jour",
        mathLevelLabel: "Niveau de maths",
        mathLevelPlaceholder: "Choisis ton niveau",
        mathLevels: [
          { value: "college", label: "Collège" },
          { value: "lycee", label: "Lycée" },
          { value: "superieur", label: "Supérieur" },
        ] as const,
        occupationLabel: "Fonction",
        occupationPlaceholder: "Sélectionne ta fonction",
        occupations: [
          { value: "student", label: "Étudiant" },
          { value: "worker", label: "Travailleur" },
          { value: "other", label: "Autre" },
        ] as const,
        missingMathLevel: "Merci d’indiquer ton niveau de maths.",
        missingOccupation: "Merci d’indiquer ta fonction.",
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
      heroTitle: "Enigmate",
      heroTagline: "Sharpen your mind every day",
      mathLevelLabel: "Math level",
      mathLevelPlaceholder: "Select your level",
      mathLevels: [
        { value: "college", label: "Middle school" },
        { value: "lycee", label: "High school" },
        { value: "superieur", label: "Higher education" },
      ] as const,
      occupationLabel: "Role",
      occupationPlaceholder: "Select your role",
      occupations: [
        { value: "student", label: "Student" },
        { value: "worker", label: "Professional" },
        { value: "other", label: "Other" },
      ] as const,
      missingMathLevel: "Please choose your math level.",
      missingOccupation: "Please choose your role.",
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
  const [mathLevel, setMathLevel] = useState("");
  const [occupation, setOccupation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidEmail = EMAIL_REGEX.test(email.trim());
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (authMode === "signIn" || (fullName.trim().length > 1 && mathLevel && occupation));

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

    if (authMode === "signUp" && !mathLevel) {
      setErrorMessage(copy.missingMathLevel);
      return;
    }

    if (authMode === "signUp" && !occupation) {
      setErrorMessage(copy.missingOccupation);
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
              math_level: mathLevel,
              occupation,
            },
          },
        });
        if (error) throw error;
        setInfoMessage(copy.verificationEmail(email));
        setMathLevel("");
        setOccupation("");
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
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;

    const startOAuth = async (provider: "linkedin" | "linkedin_oidc") => {
      return supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: "openid profile email",
        },
      });
    };

    try {
      const { error } = await startOAuth("linkedin");
      if (error) {
        if (error.message?.toLowerCase().includes("provider not enabled")) {
          const fallback = await startOAuth("linkedin_oidc");
          if (fallback.error) throw fallback.error;
        } else {
          throw error;
        }
      }
    } catch (error) {
      setLoading(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : copy.linkedinError,
      );
      return;
    }

    setLoading(false);
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
        <article className="relative flex-1 overflow-hidden rounded-[32px] border border-amber-200/30 bg-gradient-to-br from-amber-400/20 via-amber-300/10 to-transparent p-10 text-white">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
            <Image
              src="/Logo_Enigmate_Transparent.png"
              alt="Large Enigmate logo"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain"
            />
          </div>
          <div className="relative flex h-full flex-col justify-center gap-6">
            <h1 className="text-5xl font-semibold tracking-tight text-white md:text-6xl">{copy.heroTitle}</h1>
            <p className="max-w-xl text-2xl font-semibold text-amber-100 md:text-3xl">{copy.heroTagline}</p>
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
            className="group relative flex h-12 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 px-6 font-semibold text-slate-900 shadow-lg transition hover:from-amber-100 hover:via-amber-200 hover:to-orange-300"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-sm font-bold uppercase tracking-wide text-slate-900 transition group-hover:bg-white">
              in
            </span>
            <span>{copy.linkedin}</span>
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
              <>
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
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="mathLevel">
                    {copy.mathLevelLabel}
                  </label>
                  <select
                    id="mathLevel"
                    value={mathLevel}
                    onChange={(event) => setMathLevel(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/5"
                  >
                    <option value="" disabled hidden>
                      {copy.mathLevelPlaceholder}
                    </option>
                    {copy.mathLevels.map((level) => (
                      <option key={level.value} value={level.value} className="text-background">
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="occupation">
                    {copy.occupationLabel}
                  </label>
                  <select
                    id="occupation"
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition focus:border-white/40 focus:bg-white/5"
                  >
                    <option value="" disabled hidden>
                      {copy.occupationPlaceholder}
                    </option>
                    {copy.occupations.map((item) => (
                      <option key={item.value} value={item.value} className="text-background">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
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
              className="mt-2 flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300 disabled:cursor-not-allowed disabled:from-amber-200 disabled:via-amber-200 disabled:to-amber-200 disabled:opacity-60"
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
