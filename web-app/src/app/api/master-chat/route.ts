import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

type GenericSupabaseClient = SupabaseClient<unknown, "public", unknown>;

type StoredMessage = {
  id: string;
  author: "user" | "master";
  text: string;
  created_at: string;
};

type RiddleContext = {
  question: string;
  title?: string | null;
  hints?: string[];
};

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({ apiKey: openaiApiKey });

const DEFAULT_GREETING = (title?: string | null) =>
  `Bienvenue dans le duel contre le Maître${title ? ` – « ${title} »` : ""}. Décris-moi ton intuition et explorons ensemble.`;

const MAX_MESSAGES_STORED = 100;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function getAuthenticatedClient() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401 });
  }

  return { supabase, userId: session.user.id };
}

async function fetchConversation(
  supabase: GenericSupabaseClient,
  userId: string,
  riddleId: number,
): Promise<{ id: number; messages: StoredMessage[] } | null> {
  const { data, error } = await supabase
    .from("chats")
    .select("id, messages")
    .eq("user_id", userId)
    .eq("riddle_id", riddleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de récupérer la conversation: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const messages = Array.isArray(data.messages)
    ? (data.messages as StoredMessage[])
    : [];

  return { id: data.id, messages };
}

async function saveConversation(
  supabase: GenericSupabaseClient,
  userId: string,
  riddleId: number,
  messages: StoredMessage[],
  conversationId?: number,
) {
  const payload = {
    user_id: userId,
    riddle_id: riddleId,
    messages,
  };

  if (conversationId) {
    const { error } = await supabase
      .from("chats")
      .update(payload)
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Impossible de mettre à jour la conversation: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("chats").insert(payload);
    if (error) {
      throw new Error(`Impossible de créer la conversation: ${error.message}`);
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const riddleId = Number.parseInt(searchParams.get("riddleId") ?? "", 10);

    if (Number.isNaN(riddleId)) {
      return NextResponse.json({ error: "riddleId requis" }, { status: 400 });
    }

    const { supabase, userId } = await getAuthenticatedClient();
    const conversation = await fetchConversation(supabase, userId, riddleId);

    if (!conversation || conversation.messages.length === 0) {
      return NextResponse.json({
        messages: [
          {
            id: createId(),
            author: "master" as const,
            text: DEFAULT_GREETING(),
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    return NextResponse.json({ messages: conversation.messages });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const riddleId = Number.parseInt(body?.riddleId ?? "", 10);
    const message = String(body?.message ?? "").trim();
    const riddleContext: RiddleContext = body?.riddleContext;
    const revealedHints: string[] = Array.isArray(body?.revealedHints)
      ? body.revealedHints.filter((hint: unknown): hint is string => typeof hint === "string")
      : [];

    if (Number.isNaN(riddleId) || message.length === 0) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const { supabase, userId } = await getAuthenticatedClient();
    const conversation = await fetchConversation(supabase, userId, riddleId);

    const history: StoredMessage[] = conversation?.messages ?? [
      {
        id: createId(),
        author: "master",
        text: DEFAULT_GREETING(riddleContext?.title),
        created_at: new Date().toISOString(),
      },
    ];

    const userMessage: StoredMessage = {
      id: createId(),
      author: "user",
      text: message,
      created_at: new Date().toISOString(),
    };

    const augmentedHistory = [...history, userMessage].slice(-MAX_MESSAGES_STORED);

    const hintsForPrompt = (riddleContext?.hints ?? [])
      .map((hint, index) => `Indice ${index + 1} : ${hint}`)
      .join("\n");

    const revealedForPrompt = revealedHints
      .map((hint, index) => `Indice dévoilé ${index + 1} : ${hint}`)
      .join("\n");

    const systemPrompt = `Tu es "Le Maître", un mentor bienveillant qui guide l'utilisateur pour résoudre une énigme.\n\n` +
      `Énigme : ${riddleContext?.question ?? "(question inconnue)"}\n` +
      (hintsForPrompt ? `Ensemble d'indices possibles :\n${hintsForPrompt}\n\n` : "") +
      (revealedForPrompt
        ? `Indices déjà révélés à l'utilisateur :\n${revealedForPrompt}\n\n`
        : "") +
      `Ton ton est chaleureux, mystérieux mais encourageant.\n` +
      `Ne donne jamais directement la réponse finale, aide plutôt par étapes.\n` +
      `Si l'utilisateur demande explicitement un indice non dévoilé, invite-le à utiliser le panneau d'indices.\n` +
      `Tes réponses doivent être courtes (3-4 phrases) et se terminer par une question ou une invitation à poursuivre la réflexion.`;

    const openAiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...augmentedHistory.map((entry) =>
        entry.author === "master"
          ? { role: "assistant" as const, content: entry.text }
          : { role: "user" as const, content: entry.text },
      ),
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
      messages: openAiMessages,
    });

    const assistantText =
      completion.choices[0]?.message?.content?.trim() ??
      "Continuons notre exploration : que remarques-tu d'autre ?";

    const masterMessage: StoredMessage = {
      id: createId(),
      author: "master",
      text: assistantText,
      created_at: new Date().toISOString(),
    };

    const finalHistory = [...augmentedHistory, masterMessage].slice(-MAX_MESSAGES_STORED);

    await saveConversation(supabase, userId, riddleId, finalHistory, conversation?.id);

    return NextResponse.json({ messages: finalHistory });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const riddleId = Number.parseInt(body?.riddleId ?? "", 10);
    const masterMessageText = String(body?.masterMessage ?? "").trim();

    if (Number.isNaN(riddleId) || masterMessageText.length === 0) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const { supabase, userId } = await getAuthenticatedClient();
    const conversation = await fetchConversation(supabase, userId, riddleId);

    const history: StoredMessage[] = conversation?.messages ?? [];

    const masterMessage: StoredMessage = {
      id: createId(),
      author: "master",
      text: masterMessageText,
      created_at: new Date().toISOString(),
    };

    const finalHistory = [...history, masterMessage].slice(-MAX_MESSAGES_STORED);

    await saveConversation(supabase, userId, riddleId, finalHistory, conversation?.id);

    return NextResponse.json({ messages: finalHistory });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}
