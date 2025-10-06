import { NextResponse } from "next/server";

import { ensureRiddleImage } from "@/lib/riddleImage";

type EdgePayload = {
  id: number;
  question: string;
  imageURL?: string;
};

type DetailPayload = {
  title?: string | null;
  duration?: number | null;
  difficulty?: number | null;
  release_date?: string | null;
  hint1?: string | null;
  hint2?: string | null;
  hint3?: string | null;
  image_path?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

export async function GET() {
  const resolvedUrl = supabaseUrl;
  const resolvedAnonKey = supabaseAnonKey;

  if (!resolvedUrl || !resolvedAnonKey) {
    console.error("[RiddleToday] Missing Supabase env variables");
    return NextResponse.json(
      {
        error: "Supabase configuration missing on this environment.",
      },
      { status: 500 },
    );
  }

  console.log("[RiddleToday] Fetching daily riddle");
  const edgeResponse = await fetch(`${resolvedUrl}/functions/v1/riddle_today`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedAnonKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!edgeResponse.ok) {
    const body = await edgeResponse.text();
    return NextResponse.json(
      {
        error: `Edge function error (${edgeResponse.status}): ${body}`,
      },
      { status: edgeResponse.status }
    );
  }

  const edgeData = (await edgeResponse.json()) as EdgePayload | null;

  if (!edgeData) {
    return NextResponse.json(
      { error: "Aucune énigme disponible" },
      { status: 404 }
    );
  }

  console.log("[RiddleToday] Edge function payload", {
    riddleId: edgeData.id,
    hasImageURL: Boolean(edgeData.imageURL),
  });

  const detailResponse = await fetch(
    `${resolvedUrl}/rest/v1/riddles?id=eq.${edgeData.id}&select=title,duration,difficulty,release_date,hint1,hint2,hint3,image_path`,
    {
      headers: {
        apikey: resolvedAnonKey,
        Authorization: `Bearer ${resolvedAnonKey}`,
      },
      cache: "no-store",
    }
  );

  if (!detailResponse.ok) {
    const body = await detailResponse.text();
    return NextResponse.json(
      {
        error: `Riddle details error (${detailResponse.status}): ${body}`,
      },
      { status: detailResponse.status }
    );
  }

  const detailJson = (await detailResponse.json()) as DetailPayload[];
  const detail = detailJson?.[0] ?? {};

  const ensuredImage = await ensureRiddleImage(
    edgeData.id,
    edgeData.question,
    detail.image_path ?? null,
  );

  const imageURL = ensuredImage.url ?? edgeData.imageURL ?? null;

  console.log("[RiddleToday] Illustration status", {
    riddleId: edgeData.id,
    generated: ensuredImage.generated,
    imagePath: ensuredImage.imagePath,
    hasUrl: Boolean(imageURL),
  });

  return NextResponse.json({
    ...edgeData,
    imageURL,
    title: detail.title ?? null,
    duration: detail.duration ?? null,
    difficulty: detail.difficulty ?? null,
    releaseDate: detail.release_date ?? null,
    hint1: detail.hint1 ?? null,
    hint2: detail.hint2 ?? null,
    hint3: detail.hint3 ?? null,
  });
}
