import { NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? process.env.OPENAI_JUDGE_MODEL ?? "gpt-4o-mini";

const client = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title: string | null = typeof body?.title === "string" && body.title.trim().length > 0 ? body.title : null;
    const question: string | null = typeof body?.question === "string" && body.question.trim().length > 0 ? body.question : null;
    const target: "fr" | "en" = body?.target === "fr" ? "fr" : "en";

    if (!title && !question) {
      return NextResponse.json({ title: null, question: null });
    }

    if (!client) {
      return NextResponse.json({ title, question });
    }

    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            target === "fr"
              ? "Tu es un traducteur professionnel. Traduis fidèlement le titre et l'énoncé suivants vers le français. Réponds uniquement en JSON avec les clés `title` et `question`."
              : "You are a professional translator. Translate the following title and riddle prompt into English. Respond only as JSON with keys `title` and `question`.",
        },
        {
          role: "user",
          content: JSON.stringify({ title, question }, null, 2),
        },
      ],
    });

    const payloadText = completion.choices[0]?.message?.content;
    if (!payloadText) {
      return NextResponse.json({ title, question });
    }

    try {
      const parsed = JSON.parse(payloadText) as { title?: unknown; question?: unknown };
      return NextResponse.json({
        title: typeof parsed.title === "string" && parsed.title.trim().length > 0 ? parsed.title : title,
        question: typeof parsed.question === "string" && parsed.question.trim().length > 0 ? parsed.question : question,
      });
    } catch (error) {
      console.error("[RiddleTranslate] Failed to parse OpenAI response", error, payloadText);
      return NextResponse.json({ title, question });
    }
  } catch (error) {
    console.error("[RiddleTranslate] Unexpected error", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
