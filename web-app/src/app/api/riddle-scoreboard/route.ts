import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { translateRiddleContent } from "@/lib/translation";

type GenericSupabaseClient = SupabaseClient;

const MAX_RAW_SCORE = 1100;

const normalizeScore = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value <= 100) return Math.round(value);
  return Math.max(0, Math.min(100, Math.round((value / MAX_RAW_SCORE) * 100)));
};

const createClient = async (): Promise<GenericSupabaseClient> => {
  const cookieStore = await cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
};

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
    const supabase = await createClient();
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

    const normalizedScore = normalizeScore(existingScore.score ?? 0);

    console.log("[Scoreboard] Score row fetched", {
      riddleId,
      userId: session.user.id,
      score: normalizedScore,
      duration: existingScore.duration,
      msgCount: existingScore.msg_count,
    });

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("title,question,solution,hint1,hint2,hint3,difficulty,duration")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError) {
      throw new Error(riddleError.message);
    }

    console.log("[Scoreboard] Riddle context fetched", {
      riddleId,
      hasQuestion: Boolean(riddle?.question),
      hasSolution: Boolean(riddle?.solution),
      difficulty: riddle?.difficulty,
    });

    let displayTitle = riddle?.title ?? null;
    let displayQuestion = riddle?.question ?? null;
    let displaySolution = riddle?.solution ?? null;
    let displayHintsMap = {
      hint1: riddle?.hint1 ?? null,
      hint2: riddle?.hint2 ?? null,
      hint3: riddle?.hint3 ?? null,
    };

    const translated = await translateRiddleContent(
      {
        title: displayTitle,
        question: displayQuestion,
        solution: displaySolution,
        hints: displayHintsMap,
      },
      language,
    );
    displayTitle = translated.title ?? displayTitle;
    displayQuestion = translated.question ?? displayQuestion;
    displaySolution = translated.solution ?? displaySolution;
    displayHintsMap = {
      hint1: translated.hints?.hint1 ?? displayHintsMap.hint1,
      hint2: translated.hints?.hint2 ?? displayHintsMap.hint2,
      hint3: translated.hints?.hint3 ?? displayHintsMap.hint3,
    };

    const hints = [displayHintsMap.hint1, displayHintsMap.hint2, displayHintsMap.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );

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

    return NextResponse.json({
      hasScore: true,
      score: normalizedScore,
      duration: existingScore.duration ?? null,
      msgCount: existingScore.msg_count ?? null,
      hintsUsed: null,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
      hints,
      question: displayQuestion,
      officialAnswer: displaySolution,
      riddleTitle: displayTitle,
    });
  } catch (error) {
    console.error("[Scoreboard] Failed to fetch data", { riddleId, lang: language }, error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
