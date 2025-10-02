import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JUDGE_CALIBRATION_BUCKET = process.env.JUDGE_CALIBRATION_BUCKET ?? "judge-calibrations";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type SupportedLanguage = "en" | "fr";

type JudgeCalibration = {
  instructions: string;
  keyPoints: string[];
  acceptanceCriteria: string;
  redFlags: string[];
};

export type JudgeEvaluation = {
  isCorrect: boolean;
  confidence: number;
  reasoning: string;
  missingElements: string[];
};

let adminClient: SupabaseClient | null = null;
let openaiClient: OpenAI | null = null;
const memoryCache = new Map<string, { day: string; calibration: JudgeCalibration }>();

const cacheKey = (riddleId: number, language: SupportedLanguage) => `${language}-${riddleId}`;

const getAdminClient = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  }
  return adminClient;
};

const getOpenAIClient = () => {
  if (!OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
};

const ensureBucket = async (client: SupabaseClient) => {
  const { data, error } = await client.storage.listBuckets();
  if (error) return;
  if (!data?.some((bucket) => bucket.name === JUDGE_CALIBRATION_BUCKET)) {
    await client.storage.createBucket(JUDGE_CALIBRATION_BUCKET, { public: false });
  }
};

const parseCalibration = (payload: string): JudgeCalibration | null => {
  try {
    const json = JSON.parse(payload) as Partial<JudgeCalibration> & {
      key_points?: string[];
      acceptance_criteria?: string;
      red_flags?: string[];
    };
    return {
      instructions: json.instructions?.toString().trim() ?? "",
      keyPoints: Array.isArray(json.key_points)
        ? json.key_points.map((item) => item.toString())
        : Array.isArray(json.keyPoints)
          ? json.keyPoints.map((item) => item.toString())
          : [],
      acceptanceCriteria: json.acceptance_criteria?.toString().trim() ?? json.acceptanceCriteria?.toString().trim() ?? "",
      redFlags: Array.isArray(json.red_flags)
        ? json.red_flags.map((item) => item.toString())
        : Array.isArray(json.redFlags)
          ? json.redFlags.map((item) => item.toString())
          : [],
    };
  } catch (error) {
    console.error("Failed to parse judge calibration", error);
    return null;
  }
};

const buildDefaultCalibration = (language: SupportedLanguage): JudgeCalibration => ({
  instructions:
    language === "fr"
      ? "Compare la logique, les éléments clés et la conclusion de la proposition à la solution attendue."
      : "Compare the reasoning, key elements, and conclusion of the attempt against the expected solution.",
  keyPoints: [],
  acceptanceCriteria:
    language === "fr"
      ? "La réponse doit couvrir tous les éléments essentiels de la solution officielle."
      : "The answer must cover every essential element from the official solution.",
  redFlags: [],
});

const generateCalibration = async (
  openai: OpenAI,
  riddleId: number,
  question: string,
  answer: string,
  language: SupportedLanguage,
): Promise<JudgeCalibration | null> => {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_JUDGE_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            language === "fr"
              ? "Tu es Le Maître, un arbitre impartial qui construit un guide d'évaluation pour juger les réponses aux énigmes. Réponds en français sous forme de JSON avec `instructions`, `key_points`, `acceptance_criteria` et `red_flags`."
              : "You are the Master, an impartial judge building an evaluation guide for riddle answers. Respond in English as JSON with `instructions`, `key_points`, `acceptance_criteria`, and `red_flags`.",
        },
        {
          role: "user",
          content: `Riddle #${riddleId} ${language === "fr" ? "(en français)" : ""} : ${question}\n\nSolution officielle : ${answer}`,
        },
      ],
    });

    const payload = completion.choices[0]?.message?.content ?? "";
    if (!payload) return null;
    return parseCalibration(payload) ?? buildDefaultCalibration(language);
  } catch (error) {
    console.error("Failed to generate judge calibration", error);
    return null;
  }
};

export const ensureDailyJudgeCalibration = async (
  riddleId: number,
  question: string,
  answer: string,
  language: SupportedLanguage,
): Promise<JudgeCalibration | null> => {
  const openai = getOpenAIClient();
  if (!openai) return buildDefaultCalibration(language);

  const today = new Date().toISOString().slice(0, 10);
  const key = cacheKey(riddleId, language);
  const cached = memoryCache.get(key);
  if (cached && cached.day === today) {
    return cached.calibration;
  }

  const client = getAdminClient();
  if (!client) {
    const generated = await generateCalibration(openai, riddleId, question, answer, language);
    if (generated) {
      memoryCache.set(key, { day: today, calibration: generated });
    }
    return generated ?? buildDefaultCalibration(language);
  }

  await ensureBucket(client);
  const objectPath = `calibrations/${language}/${riddleId}/${today}.json`;

  try {
    const download = await client.storage.from(JUDGE_CALIBRATION_BUCKET).download(objectPath);
    if (download?.data) {
      const text = await download.data.text();
      const parsed = parseCalibration(text);
      if (parsed) {
        memoryCache.set(key, { day: today, calibration: parsed });
        return parsed;
      }
    }
  } catch {
    // ignore missing file, we'll generate below
  }

  const generated = await generateCalibration(openai, riddleId, question, answer, language);
  if (!generated) return buildDefaultCalibration(language);

  try {
    const encoded = JSON.stringify(generated, null, 2);
    await client.storage.from(JUDGE_CALIBRATION_BUCKET).upload(objectPath, encoded, {
      cacheControl: "86400",
      contentType: "application/json",
      upsert: true,
    });
  } catch (error) {
    console.error("Failed to persist judge calibration", error);
  }

  memoryCache.set(key, { day: today, calibration: generated });
  return generated;
};

export const evaluateAnswerWithJudge = async (
  riddleId: number,
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  calibration: JudgeCalibration | null,
  hints: string[],
  language: SupportedLanguage,
): Promise<JudgeEvaluation> => {
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      isCorrect: false,
      confidence: 0,
      reasoning:
        language === "fr"
          ? "Impossible de vérifier la réponse automatiquement."
          : "Automatic review unavailable.",
      missingElements: [],
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_JUDGE_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            language === "fr"
              ? "Tu es Le Maître, un juge impartial. Analyse en français la proposition de l'élève en suivant le guide fourni. Retourne un JSON avec `is_correct`, `confidence`, `reasoning` et `missing_elements`."
              : "You are the Master, an impartial judge. Analyse the student's attempt in English using the provided guide. Return JSON with `is_correct`, `confidence`, `reasoning`, and `missing_elements`.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              riddleId,
              question,
              expectedAnswer,
              userAnswer,
              revealedHints: hints,
              calibration,
              language,
            },
            null,
            2,
          ),
        },
      ],
    });

    const payload = completion.choices[0]?.message?.content ?? "";
    if (!payload) {
      return {
        isCorrect: false,
        confidence: 0,
        reasoning:
          language === "fr"
            ? "Le juge ne s'est pas prononcé."
            : "The judge did not reach a verdict.",
        missingElements: [],
      };
    }

    const parsed = JSON.parse(payload) as Partial<JudgeEvaluation> & {
      is_correct?: boolean;
      missing_elements?: unknown;
    };

    const missingElements = Array.isArray(parsed.missing_elements)
      ? parsed.missing_elements.map((item) => String(item))
      : Array.isArray(parsed.missingElements)
        ? parsed.missingElements.map((item) => String(item))
        : [];

    return {
      isCorrect: Boolean(parsed.isCorrect ?? parsed.is_correct ?? false),
      confidence: typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0,
      reasoning:
        parsed.reasoning?.toString().trim() ??
        (language === "fr"
          ? "Le juge n'a pas détaillé sa décision."
          : "The judge did not provide details."),
      missingElements,
    };
  } catch (error) {
    console.error("Judge evaluation failed", error);
    return {
      isCorrect: false,
      confidence: 0,
      reasoning:
        language === "fr"
          ? "Le juge n'a pas pu évaluer la réponse."
          : "The judge could not evaluate the answer.",
      missingElements: [],
    };
  }
};
