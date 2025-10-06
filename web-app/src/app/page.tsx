"use client";

import { AuthView } from "@/components/auth/AuthView";
import { RiddleIntro } from "@/components/riddle/RiddleIntro";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { useTranslations } from "@/components/providers/LanguageProvider";
import { TopBar } from "@/components/layout/TopBar";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { session, loading, configured } = useSupabase();
  const { t } = useTranslations();

  if (loading) {
    return (
      <div className="relative min-h-screen text-white">
        <TopBar />
        <div className="mx-auto mt-32 flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white/70" />
          <p className="text-sm text-white/60">{t("loading.subtitle")}</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="relative min-h-screen text-white">
        <TopBar />
        <div className="mx-auto mt-32 flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <p className="text-sm text-white/60">
            Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
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
