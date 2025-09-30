"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { CountdownControls, CountdownState, formatCountdown, getProgress, isLowTime } from "@/hooks/useCountdown";

interface TimerPanelProps {
  state: CountdownState;
  controls: CountdownControls;
  autoStartSeconds?: number;
}

export const TimerPanel = ({ state, controls, autoStartSeconds }: TimerPanelProps) => {
  const { timeRemaining, totalDuration, isActive, isFinished } = state;
  const { start } = controls;

  useEffect(() => {
    if (autoStartSeconds && totalDuration === 0) {
      start(autoStartSeconds);
    }
  }, [autoStartSeconds, start, totalDuration]);

  const lowTime = isLowTime(timeRemaining, totalDuration);
  const progress = getProgress(timeRemaining, totalDuration);

  return (
    <section className="rounded-3xl border border-border bg-white p-8 shadow-xl">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Chronomètre
          </p>
          <p className="text-5xl font-semibold text-foreground">
            {formatCountdown(timeRemaining || totalDuration || autoStartSeconds || 0)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            lowTime ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
          )}
        >
          {isFinished ? "Terminé" : lowTime ? "Temps critique" : isActive ? "En cours" : "Initialisation"}
        </span>
      </header>

      <div className="my-8 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", lowTime ? "bg-red-500" : "bg-primary")}
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Le chrono démarre automatiquement et ne peut pas être mis en pause : reste concentré jusqu'à la résolution.
      </p>
    </section>
  );
};
