type SummaryInput = {
  language: "en" | "fr";
  score: number;
  rankingPercent?: number | null;
  timeSpent?: number | null;
  hintsUsed?: number | null;
};

const formatDuration = (seconds: number | null | undefined, language: "en" | "fr") => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return language === "fr" ? "moins d'une minute" : "under a minute";
  }
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (minutes === 0) {
    return language === "fr"
      ? `${secs} ${secs > 1 ? "secondes" : "seconde"}`
      : `${secs} ${secs > 1 ? "seconds" : "second"}`;
  }
  if (secs === 0) {
    return language === "fr"
      ? `${minutes} ${minutes > 1 ? "minutes" : "minute"}`
      : `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;
  }
  const minuteLabel =
    language === "fr"
      ? `${minutes} ${minutes > 1 ? "minutes" : "minute"}`
      : `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;
  const secondLabel =
    language === "fr"
      ? `${secs} ${secs > 1 ? "secondes" : "seconde"}`
      : `${secs} ${secs > 1 ? "seconds" : "second"}`;
  return `${minuteLabel} ${language === "fr" ? "et" : "and"} ${secondLabel}`;
};

export const formatScoreSummary = ({
  language,
  score,
  rankingPercent,
  timeSpent,
  hintsUsed,
}: SummaryInput): string => {
  const firstSentence =
    language === "fr" ? `Score ${Math.round(score)}/100.` : `Score ${Math.round(score)}/100.`;

  const details: string[] = [];

  if (timeSpent !== null && timeSpent !== undefined) {
    const duration = formatDuration(timeSpent, language);
    details.push(
      language === "fr"
        ? `Temps de résolution ${duration}`
        : `Time spent ${duration}`,
    );
  }

  if (typeof hintsUsed === "number" && hintsUsed >= 0) {
    details.push(
      language === "fr"
        ? `Indices utilisés ${hintsUsed}`
        : `Hints used ${hintsUsed}`,
    );
  }

  if (typeof rankingPercent === "number" && Number.isFinite(rankingPercent)) {
    details.push(
      language === "fr"
        ? `Tu surpasses ${rankingPercent}% des joueurs`
        : `You outrank ${rankingPercent}% of players`,
    );
  }

  if (details.length === 0) {
    return firstSentence;
  }

  const secondSentence = `${details.join(language === "fr" ? ", " : ", ")}.`;
  return `${firstSentence} ${secondSentence}`;
};
