"use client";

import { cn } from "@/lib/utils";
import type { CountdownState } from "@/hooks/useCountdown";

interface TimerPanelProps {
  state: CountdownState;
  label: string;
  helper: string;
  statusLabels: {
    finished: string;
    critical: string;
    running: string;
    idle: string;
  };
}

export const TimerPanel = ({ state, label, helper, statusLabels }: TimerPanelProps) => {
  const { timeRemaining, totalDuration, isActive, isFinished } = state;

  const progress = totalDuration > 0 ? Math.max(timeRemaining / totalDuration, 0) : 1;
  const lowTime = totalDuration > 0 && progress <= 0.1;

  const minutes = Math.floor(timeRemaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(timeRemaining % 60)
    .toString()
    .padStart(2, "0");

  const statusLabel = isFinished
    ? statusLabels.finished
    : isActive
      ? lowTime
        ? statusLabels.critical
        : statusLabels.running
      : statusLabels.idle;

  return (
    <section className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 px-8 py-10 text-white shadow-[0_25px_80px_rgba(79,70,229,0.25)] backdrop-blur-xl transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_35px_120px_rgba(79,70,229,0.35)]">
      <div className="pointer-events-none absolute -top-32 right-[-80px] h-64 w-64 rounded-full bg-primary/40 opacity-60 blur-3xl transition-transform duration-500 group-hover:scale-110" />
      <header className="relative z-10 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-white/60">{label}</p>
          <p className="text-5xl font-semibold tracking-tight">{minutes}:{seconds}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-4 py-1 text-xs font-semibold transition-colors",
            isFinished
              ? "bg-emerald-400/20 text-emerald-200"
              : lowTime
                ? "bg-rose-500/20 text-rose-200"
                : "bg-white/10 text-white/80",
          )}
        >
          {statusLabel}
        </span>
      </header>

      <div className="relative z-10 mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            lowTime ? "bg-gradient-to-r from-rose-400 to-rose-500" : "bg-gradient-to-r from-primary to-indigo-500",
          )}
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
      </div>

      <p className="relative z-10 mt-6 text-sm text-white/70">{helper}</p>
    </section>
  );
};
