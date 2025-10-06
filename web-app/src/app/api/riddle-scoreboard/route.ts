import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { ensureResultImage } from "@/lib/resultImage";

const DIFFICULTY_LABELS: Record<number, { en: string; fr: string }> = {
  1: { en: "Novice", fr: "Novice" },
  2: { en: "Skilled", fr: "Confirmé" },
  3: { en: "Expert", fr: "Expert" },
  4: { en: "Grandmaster", fr: "Grand Maître" },
};

type GenericSupabaseClient = SupabaseClient;

const createClient = async (): Promise<GenericSupabaseClient> => {
  const cookieStore = cookies();
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

    console.log("[Scoreboard] Score row fetched", {
      riddleId,
      userId: session.user.id,
      score: existingScore.score,
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

    const hints = [riddle?.hint1, riddle?.hint2, riddle?.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );

    const difficultyEntry = typeof riddle?.difficulty === "number" ? DIFFICULTY_LABELS[riddle.difficulty] : null;
    const difficultyLabel = typeof riddle?.difficulty === "number"
      ? difficultyEntry
        ? language === "fr"
          ? difficultyEntry.fr
          : difficultyEntry.en
        : language === "fr"
          ? `Niveau ${riddle.difficulty}`
          : `Level ${riddle.difficulty}`
      : typeof riddle?.difficulty === "string"
        ? riddle.difficulty
        : null;
    const { url: resultImageURL, pending: imagePending } = await ensureResultImage(
      riddleId,
      riddle?.question ?? "",
      existingScore.score ?? 0,
      difficultyLabel,
      { eager: false },
    );
    console.log("[Scoreboard] Image status", {
      riddleId,
      userId: session.user.id,
      hasUrl: Boolean(resultImageURL),
      imagePending,
    });

    const [totalResponse, lowerResponse, equalResponse] = await Promise.all([
      supabase
        .from("scores")
        .select("score", { count: "exact", head: true })
        .eq("riddle_id", riddleId)
        .gt("score", 0),
      supabase
        .from("scores")
        .select("score", { count: "exact", head: true })
        .eq("riddle_id", riddleId)
        .gt("score", 0)
        .lt("score", existingScore.score ?? 0),
      supabase
        .from("scores")
        .select("score", { count: "exact", head: true })
        .eq("riddle_id", riddleId)
        .eq("score", existingScore.score ?? 0),
    ]);

    const totalPlayers = totalResponse.count ?? 0;
    const beatenPlayers = lowerResponse.count ?? 0;
    const tiedPlayers = equalResponse.count ?? 0;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    console.log("[Scoreboard] Returning payload", {
      riddleId,
      userId: session.user.id,
      score: existingScore.score,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
      imagePending,
      hasImage: Boolean(resultImageURL),
    });

    return NextResponse.json({
      hasScore: true,
      score: existingScore.score ?? 0,
      duration: existingScore.duration ?? null,
      msgCount: existingScore.msg_count ?? null,
      hintsUsed: null,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
      hints,
      resultImageURL,
      imagePending,
      question: riddle?.question ?? null,
      officialAnswer: riddle?.solution ?? null,
      riddleTitle: riddle?.title ?? null,
    });
  } catch (error) {
    console.error("[Scoreboard] Failed to fetch data", { riddleId, lang: language }, error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
