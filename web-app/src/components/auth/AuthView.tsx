"use client";

import { useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type AuthMode = "signIn" | "signUp";

export const AuthView = () => {
  const { supabase } = useSupabase();
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
      setErrorMessage("Veuillez saisir une adresse email valide.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
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
        setInfoMessage(
          `Un email de validation a été envoyé à ${email}. Vérifiez votre boîte de réception pour finaliser la création de votre compte.`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue. Veuillez réessayer."
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
          : "Impossible de lancer la connexion LinkedIn."
      );
    }
  };

  const handleResetPassword = async () => {
    if (!isValidEmail) {
      setErrorMessage("Saisissez une adresse email valide avant de réinitialiser le mot de passe.");
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
      setInfoMessage(
        `Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer l'email de réinitialisation."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_55%)]">
      <div className="absolute inset-x-0 top-0 mx-auto h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-16 px-6 py-16 lg:flex-row lg:items-stretch">
        <article className="w-full max-w-xl rounded-3xl border border-border bg-white/70 p-10 shadow-xl backdrop-blur">
          <header className="space-y-4 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Programme quotidien
            </span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Enigmate
              <span className="block bg-gradient-to-r from-primary via-emerald-500 to-primary bg-clip-text text-transparent">
                Deviens plus affûté chaque jour
              </span>
            </h1>
            <p className="text-base text-muted-foreground">
              1 énigme par jour, 100 jours de progression. Connecte-toi pour retrouver le Maître et reprendre le duel là où tu l'avais laissé.
            </p>
          </header>

          <div className="mt-10 flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
              🎯 Difficulté adaptée à ton niveau (novice à grand maître)
            </div>
            <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
              🧠 Résous, discute avec le Maître et mesure tes progrès
            </div>
          </div>
        </article>

        <section className="w-full max-w-md rounded-3xl border border-border bg-white p-10 shadow-xl">
          <div className="flex gap-2 rounded-full bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signIn");
                clearMessages();
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                authMode === "signIn" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signUp");
                clearMessages();
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                authMode === "signUp" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Inscription
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <button
              type="button"
              onClick={handleLinkedInSignIn}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#0A66C2] bg-[#0A66C2] font-semibold text-white transition hover:border-[#094d92] hover:bg-[#094d92]"
            >
              Continuer avec LinkedIn
            </button>

            <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="prenom.nom@email.com"
                />
              </div>

              {authMode === "signUp" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="fullName">
                    Nom complet
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Jeanne Dupont"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="password">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={authMode === "signUp" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="button"
                onClick={handleSignInOrSignUp}
                disabled={!canSubmit || loading}
                className="mt-2 h-12 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              >
                {loading
                  ? "Patientez..."
                  : authMode === "signIn"
                    ? "Se connecter"
                    : "Créer mon compte"}
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm font-medium text-primary underline-offset-4 transition hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </div>

          {(errorMessage || infoMessage) && (
            <p
              className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
                errorMessage
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
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
