import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureDailyJudgeCalibration, evaluateAnswerWithJudge, getJudgeOpenAIClient } from "@/lib/judge";
import { translateRiddleContent } from "@/lib/translation";

const DEFAULT_DURATION = 45 * 60;

const NORMALIZE_REGEX = /[\s\p{P}\p{S}]+/gu;
const MAX_RAW_SCORE = 1100;

const normalizeScore = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value <= 100) return Math.round(value);
  return Math.max(0, Math.min(100, Math.round((value / MAX_RAW_SCORE) * 100)));
};

const normalizeAnswer = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(NORMALIZE_REGEX, " ")
    .trim();

type GenericSupabaseClient = SupabaseClient;

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
  let language: "en" | "fr" = "en";
  let messages = {
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

  try {
    const body = await request.json();
    const riddleId = Number.parseInt(body?.riddleId ?? "", 10);
    const answer = String(body?.answer ?? "").trim();
    const totalDuration = Number.parseInt(String(body?.totalDuration ?? "0"), 10) || 0;
    const timeRemainingRaw = Number.parseInt(String(body?.timeRemaining ?? "0"), 10) || 0;
    const hintsUsed = Number.parseInt(String(body?.hintsUsed ?? "0"), 10) || 0;
    const userMessages = Number.parseInt(String(body?.userMessages ?? "0"), 10) || 0;
    language = body?.language === "fr" ? "fr" : "en";
    messages = language === "fr"
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
    console.log("[Submit] Incoming payload", {
      riddleId,
      answerLength: answer.length,
      totalDuration,
      timeRemainingRaw,
      hintsUsed,
      userMessages,
      language,
    });

    if (Number.isNaN(riddleId) || riddleId <= 0 || answer.length === 0) {
      console.warn("[Submit] Invalid parameters", { riddleId, answerLength: answer.length });
      return NextResponse.json({ error: messages.invalidParams }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase: GenericSupabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.warn("[Submit] Missing session", { riddleId });
      return NextResponse.json({
        error: messages.authRequired,
        requiresAuth: true,
      });
    }

    const { data: riddle, error: riddleError } = await supabase
      .from("riddles")
      .select("title,question,solution,hint1,hint2,hint3,duration,difficulty")
      .eq("id", riddleId)
      .maybeSingle();

    if (riddleError || !riddle) {
      console.error("[Submit] Riddle lookup failed", { riddleId }, riddleError);
      return NextResponse.json({ error: messages.riddleNotFound }, { status: 404 });
    }

    console.log("[Submit] Riddle fetched", {
      riddleId,
      hasQuestion: Boolean(riddle.question),
      hasSolution: Boolean(riddle.solution),
      duration: riddle.duration,
      difficulty: riddle.difficulty,
    });

    const hints = Array.isArray(body?.hints)
      ? body.hints.filter((hint: unknown): hint is string => typeof hint === 'string')
      : [riddle.hint1, riddle.hint2, riddle.hint3].filter((hint): hint is string => Boolean(hint));

    let displayTitle = riddle.title ?? null;
    let displayQuestion = riddle.question ?? null;
    let displaySolution = riddle.solution ?? null;
    let displayHintsMap = {
      hint1: riddle.hint1 ?? null,
      hint2: riddle.hint2 ?? null,
      hint3: riddle.hint3 ?? null,
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

    const displayHints = [displayHintsMap.hint1, displayHintsMap.hint2, displayHintsMap.hint3].filter(
      (hint): hint is string => Boolean(hint),
    );

    const normalizedUserAnswer = normalizeAnswer(answer);
    const normalizedExpected = normalizeAnswer(riddle.solution ?? "");
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

    if (!correct && normalizedUserAnswer.length > 0 && (riddle.solution ?? "").trim().length > 0) {
      console.log("[Submit] Delegating to judge", {
        riddleId,
        normalizedUserAnswerLength: normalizedUserAnswer.length,
        hintCount: hints.length,
      });
      const calibration = await ensureDailyJudgeCalibration(riddleId, riddle.question ?? "", riddle.solution ?? "", language);
      judgeEvaluation = await evaluateAnswerWithJudge(
        riddleId,
        riddle.question ?? "",
        riddle.solution ?? "",
        answer,
        calibration,
      hints,
      language,
    );
      console.log("[Submit] Judge responded", {
        riddleId,
        isCorrect: judgeEvaluation?.isCorrect,
        confidence: judgeEvaluation?.confidence,
        missingCount: judgeEvaluation?.missingElements?.length ?? 0,
      });
      correct = judgeEvaluation?.isCorrect ?? false;
    }

    const judgedConfidence = judgeEvaluation?.confidence ?? 0;
    const accuracyScore = correct ? 700 : Math.round(Math.max(judgedConfidence, 0) * 400);
    const speedScore = correct ? timeBonus : 0;
    const rawScore = Math.max(0, accuracyScore + speedScore - hintPenalty - chatPenalty);
    const score = normalizeScore(rawScore);

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
      return NextResponse.json({ error: messages.saveError }, { status: 500 });
    }

    const { data: scoreRows, error: scoreListError } = await supabase
      .from("scores")
      .select("score")
      .eq("riddle_id", riddleId)
      .gt("score", 0);

    if (scoreListError) {
      console.error("[Submit] Failed to list scores", scoreListError);
    }

    const normalizedScores = scoreRows
      ? scoreRows.map(({ score: value }) => normalizeScore(value)).filter((value) => value > 0)
      : [];
    const totalPlayers = normalizedScores.length;
    const beatenPlayers = normalizedScores.filter((value) => value < score).length;
    const tiedPlayers = normalizedScores.filter((value) => value === score).length;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    console.log("[Submit] Score stored", {
      riddleId,
      userId: session.user.id,
      score,
      timeSpent,
      hintsUsed,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
    });

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

    const payload = {
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
      judgeConfidence: judgeEvaluation?.confidence ?? null,
      judgeMissingElements: missingElements,
      officialAnswer: displaySolution,
      question: displayQuestion,
      riddleTitle: displayTitle,
      hints: displayHints,
    };
    console.log("[Submit] Returning response", {
      riddleId,
      userId: session.user.id,
      correct,
      score,
      rankingPercent,
      imagePending,
      hasImage: Boolean(resultImageURL),
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Submit] Unexpected error", error);
    return NextResponse.json({ error: messages.unexpected }, { status: 500 });
  }
}
