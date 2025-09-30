import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

const NORMALIZE_REGEX = /[\s\p{P}\p{S}]+/gu;

const normalizeAnswer = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(NORMALIZE_REGEX, " ")
    .trim();

type GenericSupabaseClient = SupabaseClient<unknown, "public", unknown>;

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const suggestWithLLM = async (question: string, answer: string, hints: string[], feedback: string) => {
  if (!openaiApiKey) return feedback;
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: openaiModel,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: "Tu es Le Maître. En une courte réponse, explique pourquoi la proposition ne suffit pas et suggère un angle à explorer sans dévoiler la solution.",
        },
        {
          role: "user",
          content: `Énigme : ${question}
Réponse proposée : ${answer}
Indices disponibles : ${hints.length ? hints.join(' | ') : 'aucun'}
Feedback actuel : ${feedback}`.trim(),
        },
      ],
    });
    const suggestion = completion.choices[0]?.message?.content?.trim();
    return suggestion ? `${feedback}

Le Maître te souffle : ${suggestion}` : feedback;
  } catch (error) {
    console.error('OpenAI suggestion failed', error);
    return feedback;
  }
};

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

    const cookieStore = await cookies();
    const supabase: GenericSupabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({
        error: "Connecte-toi pour enregistrer ta tentative.",
        requiresAuth: true,
      });
    }

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("question,answer,hint1,hint2,hint3")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError || !riddle) {
      return NextResponse.json({ error: "Énigme introuvable" }, { status: 404 });
    }

    const hints = Array.isArray(body?.hints)
      ? body.hints.filter((hint: unknown): hint is string => typeof hint === 'string')
      : [riddle.hint1, riddle.hint2, riddle.hint3].filter((hint): hint is string => Boolean(hint));

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
          hint_count: hintsUsed,
        },
        { onConflict: "user_id,riddle_id" },
      );

    if (upsertError) {
      console.error(upsertError);
      return NextResponse.json({ error: "Impossible d’enregistrer le score" }, { status: 500 });
    }

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
      .lt("score", score);

    const equalResponse = await supabase
      .from("scores")
      .select("score", { count: "exact", head: true })
      .eq("riddle_id", riddleId)
      .eq("score", score);

    const totalPlayers = totalResponse.count ?? 0;
    const beatenPlayers = lowerResponse.count ?? 0;
    const tiedPlayers = equalResponse.count ?? 0;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    let feedback = correct
      ? "Bravo ! Ta réponse est juste."
      : "La réponse proposée ne correspond pas. Précise certains points ou utilise un indice supplémentaire avant ta prochaine tentative.";

    if (!correct) {
      feedback = await suggestWithLLM(riddle.question ?? '', answer, hints, feedback);
    }

    return NextResponse.json({
      correct,
      score,
      feedback,
      hintsUsed,
      timeSpent,
      userMessages,
      timeRemaining,
      rankingPercent,
      beatenPlayers,
      totalPlayers,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}
