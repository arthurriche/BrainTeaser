"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations } from "@/components/providers/LanguageProvider";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export function TopBar() {
  const { t } = useTranslations();
  const { supabase, session } = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    } finally {
      router.push("/");
    }
  };

  return (
    <header className="ambient-glow sticky top-3 z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-6 rounded-full border border-amber-200/30 bg-[rgba(255,255,255,0.08)] px-6 py-3 shadow-[0_25px_80px_rgba(120,70,5,0.35)] backdrop-blur-2xl transition-all duration-500 hover:border-amber-200/50">
      <Link href="/" className="group flex items-center gap-3 text-white">
        <div className="relative h-9 w-9 overflow-hidden rounded-2xl bg-amber-300/20 shadow-inner">
          <Image src="/Logo_Enigmate_Transparent.png" alt="Enigmate logo" fill sizes="40px" className="object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-[0.3em] text-amber-100/70 transition-colors duration-500 group-hover:text-white">Enigmate</span>
          <span className="text-xs text-white/70 transition-colors duration-500 group-hover:text-white/90">{t("nav.tagline")}</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <LanguageToggle />
        {session && (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-300/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-50 transition hover:bg-amber-200/30"
          >
            <LogOut className="h-4 w-4" />
            <span>{t("nav.logout")}</span>
          </button>
        )}
      </div>
    </header>
  );
}
