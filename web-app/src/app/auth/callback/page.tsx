"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // On laisse Supabase analyser l'URL, puis on redirige vers l'accueil.
    const timer = setTimeout(() => {
      router.replace("/");
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <h1 className="text-2xl font-semibold text-white">Connexion en cours…</h1>
      <p className="max-w-sm text-sm text-white/70">
        Nous finalisons la connexion avec Supabase. Vous serez redirigé automatiquement.
      </p>
    </div>
  );
}
