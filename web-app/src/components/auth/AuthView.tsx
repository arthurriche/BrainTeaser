
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useTranslations } from "@/components/providers/LanguageProvider";
import { TopBar } from "@/components/layout/TopBar";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type AuthMode = "signIn" | "signUp";

export const AuthView = () => {
  const { supabase, configured } = useSupabase();
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

  useEffect(() => {
    if (!configured) {
      setErrorMessage(
        language === "fr"
          ? "Connexion Supabase indisponible (variables d'environnement manquantes)."
          : "Supabase connection unavailable (missing environment variables).",
      );
    }
  }, [configured, language]);

  const handleSignInOrSignUp = async () => {
    if (!supabase) {
      setErrorMessage(
        language === "fr"
          ? "Connexion Supabase indisponible."
          : "Supabase connection unavailable.",
      );
      return;
    }

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

    if (!supabase) {
      setErrorMessage(
        language === "fr"
          ? "Connexion Supabase indisponible."
          : "Supabase connection unavailable.",
      );
      setLoading(false);
      return;
    }

    const startOAuth = async (provider: "linkedin" | "linkedin_oidc") => {
      console.log("[Auth] Starting LinkedIn OAuth", { provider, redirectTo });
      const result = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: "openid profile email",
        },
      });
      if (result.error) {
        console.error("[Auth] LinkedIn OAuth failed", {
          provider,
          error: result.error.message,
        });
      } else {
        console.log("[Auth] LinkedIn OAuth initiated", { provider });
      }
      return result;
    };

    const preferred = (process.env.NEXT_PUBLIC_LINKEDIN_PROVIDER ?? "linkedin") as
      | "linkedin"
      | "linkedin_oidc";
    let candidates: Array<"linkedin" | "linkedin_oidc"> =
      preferred === "linkedin_oidc"
        ? ["linkedin_oidc", "linkedin"]
        : ["linkedin", "linkedin_oidc"];

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: {
            apikey: supabaseAnonKey,
          },
          cache: "no-store",
        });
        if (settingsResponse.ok) {
          const settings: unknown = await settingsResponse.json();
          const external =
            settings && typeof settings === "object" && "external" in settings
              ? (settings as { external?: Record<string, { enabled?: boolean }> }).external
              : null;
          const enabledProviders: Array<"linkedin" | "linkedin_oidc"> = [];
          if (external?.linkedin?.enabled) {
            enabledProviders.push("linkedin");
          }
          if (external?.linkedin_oidc?.enabled) {
            enabledProviders.push("linkedin_oidc");
          }
          if (enabledProviders.length > 0) {
            const ordered = new Set<"linkedin" | "linkedin_oidc">([
              ...enabledProviders.filter((provider) => provider === preferred),
              ...enabledProviders.filter((provider) => provider !== preferred),
            ]);
            candidates = Array.from(ordered);
          }
          console.log("[Auth] Supabase auth settings", {
            enabledLinkedin: external?.linkedin?.enabled ?? false,
            enabledLinkedinOidc: external?.linkedin_oidc?.enabled ?? false,
            candidates,
          });
        } else {
          console.warn("[Auth] Unable to fetch Supabase auth settings", {
            status: settingsResponse.status,
            statusText: settingsResponse.statusText,
          });
        }
      } else {
        console.warn("[Auth] Missing Supabase env variables; skipping settings detection");
      }
    } catch (error) {
      console.error("[Auth] Failed to inspect Supabase auth settings", error);
    }

    const errors: string[] = [];

    for (const provider of candidates) {
      console.log("[Auth] Attempting LinkedIn provider", { provider });
      try {
        const { error } = await startOAuth(provider);
        if (!error) {
          setLoading(false);
          console.log("[Auth] LinkedIn provider accepted", { provider });
          return;
        }
        const normalized = error.message?.toLowerCase() ?? "";
        if (normalized.includes("provider is not enabled") || normalized.includes("provider not enabled")) {
          console.warn("[Auth] LinkedIn provider not enabled", { provider });
          errors.push(`${provider}: provider not enabled`);
          continue;
        }
        throw error;
      } catch (error) {
        if (error instanceof Error) {
          console.error("[Auth] LinkedIn provider error", { provider, message: error.message });
          const normalized = error.message.toLowerCase();
          if (normalized.includes("provider is not enabled") || normalized.includes("provider not enabled")) {
            errors.push(`${provider}: provider not enabled`);
            continue;
          }
          if (normalized.includes("redirect_uri")) {
            setLoading(false);
            setErrorMessage(
              language === "fr"
                ? "La redirection LinkedIn ne correspond pas. Vérifie les URLs autorisées dans la console LinkedIn (supabase.co/auth/v1/callback)."
                : "LinkedIn redirect mismatch. Check the authorized URLs in the LinkedIn console (supabase.co/auth/v1/callback).",
            );
            console.error("[Auth] LinkedIn redirect mismatch", error);
            return;
          }
          setLoading(false);
          setErrorMessage(error.message);
          return;
        }
        console.error("[Auth] LinkedIn provider threw non-error", { provider, value: error });
        setLoading(false);
        setErrorMessage(copy.linkedinError);
        return;
      }
    }

    setLoading(false);
    const message =
      errors.length > 0
        ? errors.join(" | ")
        : language === "fr"
          ? "Impossible de contacter LinkedIn."
          : "We couldn't reach LinkedIn.";
    console.warn("[Auth] LinkedIn providers exhausted", { errors });
    setErrorMessage(
      language === "fr"
        ? `${message} Activez le provider approprié dans Supabase.`
        : `${message} Enable the appropriate provider in Supabase.`,
    );
  };

  const handleResetPassword = async () => {
    if (!isValidEmail) {
      setErrorMessage(copy.invalidEmail);
      return;
    }

    if (!supabase) {
      setErrorMessage(
        language === "fr"
          ? "Connexion Supabase indisponible."
          : "Supabase connection unavailable.",
      );
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
        <article className="animate-section animate-delay-1 relative flex-1 overflow-hidden rounded-[32px] border border-amber-200/30 bg-gradient-to-br from-amber-400/20 via-amber-300/10 to-transparent p-10 text-white">
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

        <section className="glass-panel animate-section animate-delay-2 flex-1 space-y-8 p-10">
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
            className="button-aurora hover-lift group relative flex h-12 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-orange-400 px-6 font-semibold text-slate-900 shadow-lg transition hover:from-amber-100 hover:via-amber-200 hover:to-orange-300"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-sm font-bold uppercase tracking-wide text-slate-900 transition group-hover:bg-white">
              in
            </span>
            <span>{copy.linkedin}</span>
          </button>

            <div className="stagger-container space-y-4 rounded-2xl border border-white/15 bg-white/5 p-6">
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
              className="button-aurora hover-lift mt-2 flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 font-semibold text-slate-900 shadow-lg transition hover:from-amber-200 hover:via-amber-300 hover:to-orange-300 disabled:cursor-not-allowed disabled:from-amber-200 disabled:via-amber-200 disabled:to-amber-200 disabled:opacity-60"
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
