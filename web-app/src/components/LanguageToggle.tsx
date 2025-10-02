"use client";

import { useLanguage, useTranslations } from "@/components/providers/LanguageProvider";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslations();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={t("nav.languageToggle")}
      className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90 shadow-[0_10px_30px_rgba(65,64,221,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/20 hover:text-white"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">{language === "en" ? "FR" : "EN"}</span>
      <span className="text-xs text-white/80">{language === "en" ? "Français" : "English"}</span>
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(circle at 0% 0%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(circle at 110% 10%, rgba(109,158,255,0.45), transparent 60%)",
        }}
      />
    </button>
  );
}
