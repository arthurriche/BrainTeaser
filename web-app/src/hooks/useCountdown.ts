"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CountdownState = {
  timeRemaining: number;
  totalDuration: number;
  isActive: boolean;
  isFinished: boolean;
};

export type CountdownControls = {
  start: (durationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  addTime: (seconds: number) => void;
  reset: () => void;
};

export function useCountdown(): [CountdownState, CountdownControls] {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setTimeRemaining((prev) => {
      if (prev <= 1) {
        clearTimer();
        setIsActive(false);
        setIsFinished(true);
        return 0;
      }
      return prev - 1;
    });
  }, [clearTimer]);

  const start = useCallback(
    (durationSeconds: number) => {
      clearTimer();
      setTotalDuration(durationSeconds);
      setTimeRemaining(durationSeconds);
      setIsFinished(false);
      setIsActive(true);
      intervalRef.current = setInterval(tick, 1000);
    },
    [clearTimer, tick]
  );

  const pause = useCallback(() => {
    clearTimer();
    setIsActive(false);
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsFinished(false);
    setIsActive(true);
    if (!intervalRef.current) {
      intervalRef.current = setInterval(tick, 1000);
    }
  }, [tick]);

  const addTime = useCallback((seconds: number) => {
    setTimeRemaining((prev) => Math.max(prev + seconds, 0));
    setTotalDuration((prev) => Math.max(prev + seconds, 0));
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setTimeRemaining(0);
    setTotalDuration(0);
    setIsActive(false);
    setIsFinished(false);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [
    {
      timeRemaining,
      totalDuration,
      isActive,
      isFinished,
    },
    { start, pause, resume, addTime, reset },
  ];
}

export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function getProgress(timeRemaining: number, totalDuration: number): number {
  if (totalDuration === 0) return 1;
  return Math.max(timeRemaining / totalDuration, 0);
}

export function isLowTime(timeRemaining: number, totalDuration: number): boolean {
  if (totalDuration === 0) return false;
  return getProgress(timeRemaining, totalDuration) <= 0.1;
}
