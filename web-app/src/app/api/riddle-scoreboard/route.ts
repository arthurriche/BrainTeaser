import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { PREMIUM_PRICES, SOCIAL_LINKS } from "@/lib/premium";
import { evaluatePremiumAccess } from "@/lib/server/premium-access";
import { formatScoreSummary } from "@/lib/scoreSummary";
import { translateRiddleContent } from "@/lib/translation";

type GenericSupabaseClient = SupabaseClient;

const MAX_RAW_SCORE = 1100;

const normalizeScore = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value <= 100) return Math.round(value);
  return Math.max(0, Math.min(100, Math.round((value / MAX_RAW_SCORE) * 100)));
};

const createClient = (): GenericSupabaseClient => createRouteHandlerClient({ cookies });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const languageParam = searchParams.get("lang");
  const language: "en" | "fr" = languageParam === "fr" ? "fr" : "en";
  const messages = language === "fr"
    ? {
        invalidRiddle: "riddleId requis",
        authRequired: "Connecte-toi pour accéder au classement.",
        unexpected: "Erreur inattendue",
      }
    : {
        invalidRiddle: "riddleId required",
        authRequired: "Sign in to view the leaderboard.",
        unexpected: "Unexpected error",
      };

  const riddleId = Number.parseInt(searchParams.get("riddleId") ?? "", 10);
  if (Number.isNaN(riddleId) || riddleId <= 0) {
    console.warn("[Scoreboard] Invalid riddle id", { riddleId, lang: language });
    return NextResponse.json({ error: messages.invalidRiddle }, { status: 400 });
  }

  try {
    console.log("[Scoreboard] Incoming request", { riddleId, language });
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("[Scoreboard] Missing session", { riddleId });
      return NextResponse.json({
        error: messages.authRequired,
        requiresAuth: true,
        hasScore: false,
      });
    }

    const { data: existingScore, error: scoreError } = await supabase
      .from("scores")
      .select("score,duration,msg_count")
      .eq("user_id", session.user.id)
      .eq("riddle_id", riddleId)
      .maybeSingle();

    if (scoreError) {
      throw new Error(scoreError.message);
    }

    if (!existingScore) {
      console.log("[Scoreboard] No score found", { riddleId, userId: session.user.id });
      return NextResponse.json({ hasScore: false });
    }

    const premiumAccess = await evaluatePremiumAccess(supabase, session.user.id, riddleId);

    const normalizedScore = normalizeScore(existingScore.score ?? 0);

    console.log("[Scoreboard] Score row fetched", {
      riddleId,
      userId: session.user.id,
      score: normalizedScore,
      duration: existingScore.duration,
      msgCount: existingScore.msg_count,
      premiumUnlocked: premiumAccess.unlocked,
      premiumType: premiumAccess.type,
    });

    let displayTitle: string | null = null;
    let displayQuestion: string | null = null;
    let displaySolution: string | null = null;
    let displayHints: string[] = [];

    if (premiumAccess.unlocked) {
      const { data: riddle, error: riddleError } = await supabase
        .from("riddles")
        .select("title,question,solution,hint1,hint2,hint3")
        .eq("id", riddleId)
        .maybeSingle();

      if (riddleError) {
        throw new Error(riddleError.message);
      }

      console.log("[Scoreboard] Premium riddle context fetched", {
        riddleId,
        hasQuestion: Boolean(riddle?.question),
        hasSolution: Boolean(riddle?.solution),
      });

      let tempTitle = riddle?.title ?? null;
      let tempQuestion = riddle?.question ?? null;
      let tempSolution = riddle?.solution ?? null;
      let tempHints = {
        hint1: riddle?.hint1 ?? null,
        hint2: riddle?.hint2 ?? null,
        hint3: riddle?.hint3 ?? null,
      };

      const translated = await translateRiddleContent(
        {
          title: tempTitle,
          question: tempQuestion,
          solution: tempSolution,
          hints: tempHints,
        },
        language,
      );
      tempTitle = translated.title ?? tempTitle;
      tempQuestion = translated.question ?? tempQuestion;
      tempSolution = translated.solution ?? tempSolution;
      tempHints = {
        hint1: translated.hints?.hint1 ?? tempHints.hint1,
        hint2: translated.hints?.hint2 ?? tempHints.hint2,
        hint3: translated.hints?.hint3 ?? tempHints.hint3,
      };

      displayTitle = tempTitle;
      displayQuestion = tempQuestion;
      displaySolution = tempSolution;
      displayHints = [tempHints.hint1, tempHints.hint2, tempHints.hint3].filter(
        (hint): hint is string => Boolean(hint),
      );
    } else {
      const { data: riddleMeta, error: riddleMetaError } = await supabase
        .from("riddles")
        .select("title")
        .eq("id", riddleId)
        .maybeSingle();

      if (riddleMetaError) {
        throw new Error(riddleMetaError.message);
      }
      displayTitle = riddleMeta?.title ?? null;
    }

    const { data: scoreRows, error: scoreListError } = await supabase
      .from("scores")
      .select("score")
      .eq("riddle_id", riddleId)
      .gt("score", 0);

    if (scoreListError) {
      console.error("[Scoreboard] Failed to list scores", scoreListError);
    }

    const normalizedScores = scoreRows
      ? scoreRows.map(({ score }) => normalizeScore(score)).filter((value) => value > 0)
      : [];
    const totalPlayers = normalizedScores.length;
    const beatenPlayers = normalizedScores.filter((value) => value < normalizedScore).length;
    const tiedPlayers = normalizedScores.filter((value) => value === normalizedScore).length;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    console.log("[Scoreboard] Returning payload", {
      riddleId,
      userId: session.user.id,
      score: normalizedScore,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
    });

    const summary = formatScoreSummary({
      language,
      score: normalizedScore,
      rankingPercent,
      timeSpent: existingScore.duration ?? null,
    });
    const lockedMessage =
      language === "fr"
        ? "Débloque le débrief complet pour accéder à l'analyse détaillée."
        : "Unlock premium to access the full breakdown.";

    const unlockOptions = {
      single: {
        amountCents: PREMIUM_PRICES.single.amountCents,
        currency: PREMIUM_PRICES.single.currency,
      },
      subscription: {
        amountCents: PREMIUM_PRICES.subscription.amountCents,
        currency: PREMIUM_PRICES.subscription.currency,
      },
    };
    const isLocked = !premiumAccess.unlocked;
    const feedbackShort = summary;
    const feedback = isLocked ? `${summary} ${lockedMessage}`.trim() : null;

    return NextResponse.json({
      hasScore: true,
      score: normalizedScore,
      duration: existingScore.duration ?? null,
      msgCount: existingScore.msg_count ?? null,
      hintsUsed: null,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
      hints: premiumAccess.unlocked ? displayHints : [],
      question: premiumAccess.unlocked ? displayQuestion : null,
      officialAnswer: premiumAccess.unlocked ? displaySolution : null,
      riddleTitle: displayTitle,
      premiumAccess: {
        unlocked: premiumAccess.unlocked,
        type: premiumAccess.type,
        validUntil: premiumAccess.validUntil,
      },
      unlockOptions,
      socialLinks: SOCIAL_LINKS,
      feedback,
      feedbackShort,
      locked: isLocked,
      lockReason: premiumAccess.unlocked
        ? null
        : language === "fr"
          ? "Abonne-toi ou débloque cette énigme pour voir les indices et la solution officielle."
          : "Subscribe or unlock this puzzle to view the hints and official solution.",
    });
  } catch (error) {
    console.error("[Scoreboard] Failed to fetch data", { riddleId, lang: language }, error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
