import { getJudgeOpenAIClient } from "@/lib/judge";
import type { SupportedLanguage } from "@/lib/judge";

const OPENAI_TRANSLATION_MODEL =
  process.env.OPENAI_TRANSLATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type HintMap = {
  hint1?: string | null;
  hint2?: string | null;
  hint3?: string | null;
};

export type RiddleTranslatableFields = {
  title?: string | null;
  question?: string | null;
  solution?: string | null;
  hints?: HintMap;
};

const hasContent = (value: string | null | undefined) => typeof value === "string" && value.trim().length > 0;

const sanitizeHints = (hints?: HintMap) => ({
  hint1: hints?.hint1 ?? "",
  hint2: hints?.hint2 ?? "",
  hint3: hints?.hint3 ?? "",
});

const normalizeString = (value: unknown, fallback: string | null | undefined) => {
  if (typeof value !== "string") return fallback ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback ?? null;
};

export const translateRiddleContent = async (
  fields: RiddleTranslatableFields,
  targetLanguage: SupportedLanguage,
): Promise<RiddleTranslatableFields> => {
  const openai = getJudgeOpenAIClient();
  if (!openai) {
    console.warn("[Translation] OpenAI client unavailable, returning original fields");
    return fields;
  }

  const { title, question, solution } = fields;
  const hints = sanitizeHints(fields.hints);
  if (![title, question, solution, hints.hint1, hints.hint2, hints.hint3].some(hasContent)) {
    return fields;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_TRANSLATION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a precise translator. Translate the provided puzzle content into ${
            targetLanguage === "en" ? "English" : "French"
          } while preserving markdown, tone, and intent. If the text is already in the target language, return it unchanged. Respond strictly as JSON with keys: title, question, solution, hints (object with hint1, hint2, hint3). Leave fields empty when there is no text.`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              targetLanguage,
              title: title ?? "",
              question: question ?? "",
              solution: solution ?? "",
              hints,
            },
            null,
            2,
          ),
        },
      ],
    });

    const payload = completion.choices[0]?.message?.content ?? "";
    if (!payload) {
      console.warn("[Translation] Empty translation payload received");
      return fields;
    }

    let parsed: {
      title?: unknown;
      question?: unknown;
      solution?: unknown;
      hints?: { hint1?: unknown; hint2?: unknown; hint3?: unknown } | unknown;
    };
    try {
      parsed = JSON.parse(payload);
    } catch (parseError) {
      console.error("[Translation] Failed to parse translation payload", payload, parseError);
      return fields;
    }

    const rawHints =
      parsed && typeof parsed === "object" && "hints" in parsed && parsed.hints && typeof parsed.hints === "object"
        ? (parsed.hints as { hint1?: unknown; hint2?: unknown; hint3?: unknown })
        : undefined;

    return {
      title: normalizeString(parsed.title, title),
      question: normalizeString(parsed.question, question),
      solution: normalizeString(parsed.solution, solution),
      hints: {
        hint1: normalizeString(rawHints?.hint1, fields.hints?.hint1),
        hint2: normalizeString(rawHints?.hint2, fields.hints?.hint2),
        hint3: normalizeString(rawHints?.hint3, fields.hints?.hint3),
      },
    };
  } catch (error) {
    console.error("[Translation] OpenAI translation failed", error);
    return fields;
  }
};
