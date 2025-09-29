"use client";

import { AuthView } from "@/components/auth/AuthView";
import { RiddleIntro } from "@/components/riddle/RiddleIntro";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export default function Home() {
  const { session, loading } = useSupabase();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="text-sm font-medium text-white/70">
            Initialisation de votre session…
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return <RiddleIntro />;
}
