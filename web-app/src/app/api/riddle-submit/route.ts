import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureResultImage } from "@/lib/resultImage";
import { ensureDailyJudgeCalibration, evaluateAnswerWithJudge, getJudgeOpenAIClient } from "@/lib/judge";

const DEFAULT_DURATION = 45 * 60;

const DIFFICULTY_LABELS: Record<number, { en: string; fr: string }> = {
  1: { en: "Novice", fr: "Novice" },
  2: { en: "Skilled", fr: "Confirmé" },
  3: { en: "Expert", fr: "Expert" },
  4: { en: "Grandmaster", fr: "Grand Maître" },
};

const NORMALIZE_REGEX = /[\s\p{P}\p{S}]+/gu;

const normalizeAnswer = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(NORMALIZE_REGEX, " ")
    .trim();

type GenericSupabaseClient = SupabaseClient<unknown, "public", unknown>;

const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const suggestWithLLM = async (
  openai: ReturnType<typeof getJudgeOpenAIClient>,
  question: string,
  answer: string,
  hints: string[],
  feedback: string,
  language: "en" | "fr",
) => {
  if (!openai) return feedback;
  try {
    const completion = await openai.chat.completions.create({
      model: openaiModel,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            language === "fr"
              ? "Tu es Le Maître. En une courte réponse, explique pourquoi la proposition ne suffit pas et suggère un angle à explorer sans dévoiler la solution. Réponds en français."
              : "You are the Master. Briefly explain why the attempt is insufficient and suggest one avenue to explore without revealing the solution. Reply in English.",
        },
        {
          role: "user",
          content:
            language === "fr"
              ? `Énigme : ${question}
Réponse proposée : ${answer}
Indices disponibles : ${hints.length ? hints.join(' | ') : 'aucun'}
Feedback actuel : ${feedback}`.trim()
              : `Riddle: ${question}
Proposed answer: ${answer}
Available hints: ${hints.length ? hints.join(' | ') : 'none'}
Current feedback: ${feedback}`.trim(),
        },
      ],
    });
    const suggestion = completion.choices[0]?.message?.content?.trim();
    if (!suggestion) return feedback;
    const prefix = language === "fr" ? "Le Maître te souffle : " : "The Master hints: ";
    return `${feedback}

${prefix}${suggestion}`;
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
    const timeRemainingRaw = Number.parseInt(String(body?.timeRemaining ?? "0"), 10) || 0;
    const hintsUsed = Number.parseInt(String(body?.hintsUsed ?? "0"), 10) || 0;
    const userMessages = Number.parseInt(String(body?.userMessages ?? "0"), 10) || 0;
    const language: "en" | "fr" = body?.language === "fr" ? "fr" : "en";
    const messages = language === "fr"
      ? {
          invalidParams: "Paramètres invalides",
          authRequired: "Connecte-toi pour enregistrer ta tentative.",
          riddleNotFound: "Énigme introuvable",
          saveError: "Impossible d’enregistrer le score",
          unexpected: "Erreur inattendue",
          correctReasoning: "Ta réponse correspond à la solution officielle.",
          correctFallback: "Bravo ! Ta réponse est juste.",
          incorrectBase: "La réponse proposée ne correspond pas.",
          missingLabel: "Points à retravailler",
          whisperPrefix: "Le Maître te souffle :",
        }
      : {
          invalidParams: "Invalid parameters",
          authRequired: "Sign in to record your attempt.",
          riddleNotFound: "Riddle not found",
          saveError: "Unable to save the score",
          unexpected: "Unexpected error",
          correctReasoning: "Your answer matches the official solution.",
          correctFallback: "Well done! Your answer matches the official solution.",
          incorrectBase: "The proposed answer doesn't match.",
          missingLabel: "Sharpen these points",
          whisperPrefix: "The Master hints:",
        };

    if (Number.isNaN(riddleId) || riddleId <= 0 || answer.length === 0) {
      return NextResponse.json({ error: messages.invalidParams }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase: GenericSupabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({
        error: messages.authRequired,
        requiresAuth: true,
      });
    }

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("question,answer,hint1,hint2,hint3,duration,difficulty")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError || !riddle) {
      return NextResponse.json({ error: messages.riddleNotFound }, { status: 404 });
    }

    const hints = Array.isArray(body?.hints)
      ? body.hints.filter((hint: unknown): hint is string => typeof hint === 'string')
      : [riddle.hint1, riddle.hint2, riddle.hint3].filter((hint): hint is string => Boolean(hint));

    const normalizedUserAnswer = normalizeAnswer(answer);
    const normalizedExpected = normalizeAnswer(riddle.answer ?? "");
    let correct = normalizedUserAnswer.length > 0 && normalizedUserAnswer === normalizedExpected;
    let judgeEvaluation = correct
      ? {
          isCorrect: true,
          confidence: 1,
          reasoning: messages.correctReasoning,
          missingElements: [] as string[],
        }
      : null;

    const baseDuration = totalDuration > 0 ? totalDuration : riddle.duration ?? DEFAULT_DURATION;
    const sanitizedDuration = Number.isFinite(baseDuration) && baseDuration > 0 ? baseDuration : DEFAULT_DURATION;
    const clampedRemaining = Math.min(Math.max(timeRemainingRaw, 0), sanitizedDuration);
    const timeSpent = Math.max(0, sanitizedDuration - clampedRemaining);
    const effectiveTotal = Math.max(sanitizedDuration, 1);
    const timeBonus = Math.round((clampedRemaining / effectiveTotal) * 400);
    const hintPenalty = hintsUsed * 150;
    const chatPenalty = Math.max(0, (userMessages - 1) * 25);

    if (!correct && normalizedUserAnswer.length > 0 && (riddle.answer ?? "").trim().length > 0) {
      const calibration = await ensureDailyJudgeCalibration(riddleId, riddle.question ?? "", riddle.answer ?? "", language);
      judgeEvaluation = await evaluateAnswerWithJudge(
        riddleId,
        riddle.question ?? "",
        riddle.answer ?? "",
        answer,
        calibration,
        hints,
        language,
      );
      correct = judgeEvaluation?.isCorrect ?? false;
    }

    const baseScore = correct ? 700 : 300;
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
      return NextResponse.json({ error: messages.saveError }, { status: 500 });
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

    const difficultyEntry = typeof riddle.difficulty === "number" ? DIFFICULTY_LABELS[riddle.difficulty] : null;
    const difficultyLabel = typeof riddle.difficulty === "number"
      ? difficultyEntry
        ? language === "fr"
          ? difficultyEntry.fr
          : difficultyEntry.en
        : language === "fr"
          ? `Niveau ${riddle.difficulty}`
          : `Level ${riddle.difficulty}`
      : typeof riddle.difficulty === "string"
        ? riddle.difficulty
        : null;
    const resultImageURL = await ensureResultImage(
      riddleId,
      riddle.question ?? "",
      score,
      difficultyLabel,
      { eager: false },
    );

    const openaiClient = getJudgeOpenAIClient();
    const baseReasoning = judgeEvaluation?.reasoning?.trim();
    const missingElements = judgeEvaluation?.missingElements ?? [];

    const successPrefix = language === "fr" ? "Bravo !" : "Well done!";
    let feedback = correct
      ? baseReasoning
        ? `${successPrefix} ${baseReasoning}`
        : messages.correctFallback
      : `${baseReasoning ?? messages.incorrectBase}${missingElements.length ? `\n\n${messages.missingLabel} : ${missingElements.join(' · ')}.` : ""}`;

    if (!correct) {
      feedback = await suggestWithLLM(openaiClient, riddle.question ?? '', answer, hints, feedback, language);
    }

    return NextResponse.json({
      correct,
      score,
      feedback,
      hintsUsed,
      timeSpent,
      userMessages,
      timeRemaining: clampedRemaining,
      rankingPercent,
      beatenPlayers,
      totalPlayers,
      resultImageURL,
      judgeConfidence: judgeEvaluation?.confidence ?? null,
      judgeMissingElements: missingElements,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
