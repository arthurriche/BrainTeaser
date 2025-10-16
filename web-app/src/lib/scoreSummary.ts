type SummaryInput = {
  score: number;
  rankingPercent?: number | null;
  timeSpent?: number | null;
  hintsUsed?: number | null;
};

const formatDuration = (seconds: number | null | undefined) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "under a minute";
  }
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (minutes === 0) {
    return `${secs} ${secs > 1 ? "seconds" : "second"}`;
  }
  if (secs === 0) {
    return `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;
  }
  const minuteLabel = `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;
  const secondLabel = `${secs} ${secs > 1 ? "seconds" : "second"}`;
  return `${minuteLabel} and ${secondLabel}`;
};

export const formatScoreSummary = ({ score, rankingPercent, timeSpent, hintsUsed }: SummaryInput): string => {
  const firstSentence = `Score ${Math.round(score)}/100.`;

  const details: string[] = [];

  if (timeSpent !== null && timeSpent !== undefined) {
    const duration = formatDuration(timeSpent);
    details.push(`Time spent ${duration}`);
  }

  if (typeof hintsUsed === "number" && hintsUsed >= 0) {
    details.push(`Hints used ${hintsUsed}`);
  }

  if (typeof rankingPercent === "number" && Number.isFinite(rankingPercent)) {
    details.push(`You outrank ${rankingPercent}% of players`);
  }

  if (details.length === 0) {
    return firstSentence;
  }

  const secondSentence = `${details.join(", ")}.`;
  return `${firstSentence} ${secondSentence}`;
};
