"use client";

import { cn } from "@/lib/utils";
import type { CountdownState } from "@/hooks/useCountdown";

interface TimerPanelProps {
  state: CountdownState;
  label?: string;
}

export const TimerPanel = ({ state, label = "Chronomètre" }: TimerPanelProps) => {
  const { timeRemaining, totalDuration, isActive, isFinished } = state;

  const progress = totalDuration > 0 ? Math.max(timeRemaining / totalDuration, 0) : 1;
  const lowTime = totalDuration > 0 && progress <= 0.1;

  const minutes = Math.floor(timeRemaining / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(timeRemaining % 60)
    .toString()
    .padStart(2, "0");

  return (
    <section className="rounded-3xl border border-border bg-white p-8 shadow-xl">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
          <p className="text-5xl font-semibold text-foreground">{minutes}:{seconds}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            isFinished ? "bg-emerald-100 text-emerald-600" : lowTime ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary",
          )}
        >
          {isFinished ? "Terminé" : isActive ? (lowTime ? "Temps critique" : "En cours") : "Initialisation"}
        </span>
      </header>

      <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", lowTime ? "bg-red-500" : "bg-primary")}
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
      </div>
    </section>
  );
};
