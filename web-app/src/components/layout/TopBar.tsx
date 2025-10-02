"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations } from "@/components/providers/LanguageProvider";

export function TopBar() {
  const { t } = useTranslations();

  return (
    <header className="sticky top-3 z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-6 rounded-full border border-white/15 bg-white/10 px-6 py-3 shadow-[0_25px_80px_rgba(60,52,160,0.35)] backdrop-blur-2xl transition-all duration-500 hover:border-white/25">
      <Link href="/" className="flex items-center gap-3 text-white">
        <div className="relative h-9 w-9 overflow-hidden rounded-2xl bg-white/10 shadow-inner">
          <Image src="/Logo_Enigmate_Transparent.png" alt="Enigmate logo" fill sizes="40px" className="object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-[0.3em] text-white/60">Enigmate</span>
          <span className="text-xs text-white/70">{t("nav.tagline")}</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <LanguageToggle />
      </div>
    </header>
  );
}
