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

type GenericSupabaseClient = SupabaseClient<unknown, "public", unknown>;

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
    return NextResponse.json({ error: messages.invalidRiddle }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({
        error: messages.authRequired,
        requiresAuth: true,
        hasScore: false,
      });
    }

    const { data: existingScore, error: scoreError } = await supabase
      .from("scores")
      .select("score,duration,msg_count,hint_count")
      .eq("user_id", session.user.id)
      .eq("riddle_id", riddleId)
      .maybeSingle();

    if (scoreError) {
      throw new Error(scoreError.message);
    }

    if (!existingScore) {
      return NextResponse.json({ hasScore: false });
    }

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("title,question,answer,hint1,hint2,hint3,difficulty,duration")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError) {
      throw new Error(riddleError.message);
    }

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
    const resultImageURL = await ensureResultImage(
      riddleId,
      riddle?.question ?? "",
      existingScore.score ?? 0,
      difficultyLabel,
      { eager: false },
    );

    const totalResponse = await supabase
      .from("scores")
      .select("score", { count: "exact", head: true })
      .eq("riddle_id", riddleId)
      .gt("score", 0);

    const lowerResponse = await supabase
      .from("scores")
      .select("score", { count: "exact", head: true })
      .eq("riddle_id", riddleId)
      .gt("score", 0)
      .lt("score", existingScore.score ?? 0);

    const equalResponse = await supabase
      .from("scores")
      .select("score", { count: "exact", head: true })
      .eq("riddle_id", riddleId)
      .eq("score", existingScore.score ?? 0);

    const totalPlayers = totalResponse.count ?? 0;
    const beatenPlayers = lowerResponse.count ?? 0;
    const tiedPlayers = equalResponse.count ?? 0;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    return NextResponse.json({
      hasScore: true,
      score: existingScore.score ?? 0,
      duration: existingScore.duration ?? null,
      msgCount: existingScore.msg_count ?? null,
      hintsUsed: existingScore.hint_count ?? null,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
      hints,
      resultImageURL,
      question: riddle?.question ?? null,
      officialAnswer: riddle?.answer ?? null,
      riddleTitle: riddle?.title ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
