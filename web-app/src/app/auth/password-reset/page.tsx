"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export default function PasswordResetPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setMessage("Mot de passe mis à jour avec succès. Vous allez être redirigé.");
      setTimeout(() => router.replace("/"), 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour le mot de passe."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-white/5 p-8 text-white shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-bold">Réinitialiser votre mot de passe</h1>
        <p className="mt-2 text-sm text-white/70">
          Choisissez un nouveau mot de passe sécurisé pour votre compte Enigmate.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <label className="text-sm font-medium" htmlFor="newPassword">
            Nouveau mot de passe
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none transition focus:border-white/60"
          />

          <label className="text-sm font-medium" htmlFor="confirmPassword">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none transition focus:border-white/60"
          />

          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={loading}
            className="mt-4 h-12 rounded-2xl bg-white font-semibold text-[#111827] transition hover:bg-white/90 disabled:cursor-progress disabled:bg-white/30 disabled:text-white/60"
          >
            {loading ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </div>

        {(error || message) && (
          <p className={`mt-6 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}>
            {error ?? message}
          </p>
        )}
      </div>
    </div>
  );
}
