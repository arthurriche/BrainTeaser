import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const NORMALIZE_REGEX = /[\s\p{P}\p{S}]+/gu;

const normalizeAnswer = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(NORMALIZE_REGEX, " ")
    .trim();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const riddleId = Number.parseInt(body?.riddleId ?? "", 10);
    const answer = String(body?.answer ?? "").trim();
    const totalDuration = Number.parseInt(String(body?.totalDuration ?? "0"), 10) || 0;
    const timeRemaining = Number.parseInt(String(body?.timeRemaining ?? "0"), 10) || 0;
    const hintsUsed = Number.parseInt(String(body?.hintsUsed ?? "0"), 10) || 0;
    const userMessages = Number.parseInt(String(body?.userMessages ?? "0"), 10) || 0;

    if (Number.isNaN(riddleId) || riddleId <= 0 || answer.length === 0) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("answer")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError || !riddle) {
      return NextResponse.json({ error: "Énigme introuvable" }, { status: 404 });
    }

    const normalizedUserAnswer = normalizeAnswer(answer);
    const normalizedExpected = normalizeAnswer(riddle.answer ?? "");
    const correct = normalizedUserAnswer.length > 0 && normalizedUserAnswer === normalizedExpected;

    const effectiveTotal = totalDuration > 0 ? totalDuration : timeRemaining;
    const timeSpent = Math.max(0, effectiveTotal - timeRemaining);
    const timeBonus = effectiveTotal > 0 ? Math.round((timeRemaining / effectiveTotal) * 400) : 0;
    const baseScore = correct ? 700 : 300;
    const hintPenalty = hintsUsed * 150;
    const chatPenalty = Math.max(0, (userMessages - 1) * 25);
    const score = Math.max(0, baseScore + timeBonus - hintPenalty - chatPenalty);

    const { error: upsertError } = await supabase
      .from("scores")
      .upsert(
        {
          user_id: session.user.id,
          riddle_id: riddleId,
          score,
          duration: timeSpent,
          msg_count: userMessages,
        },
        { onConflict: "user_id,riddle_id" },
      );

    if (upsertError) {
      console.error(upsertError);
      return NextResponse.json({ error: "Impossible d'enregistrer le score" }, { status: 500 });
    }

    const feedback = correct
      ? "Bravo ! Ta réponse est juste."
      : "La réponse proposée ne correspond pas. Continue de creuser ou reviens avec une nouvelle intuition.";

    return NextResponse.json({
      correct,
      score,
      feedback,
      hintsUsed,
      timeSpent,
      userMessages,
      timeRemaining,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}
