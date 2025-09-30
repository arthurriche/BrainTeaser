import { NextResponse } from "next/server";

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
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are not set. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export async function GET() {
  const edgeResponse = await fetch(`${supabaseUrl}/functions/v1/riddle_today`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
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

  const detailResponse = await fetch(
    `${supabaseUrl}/rest/v1/riddles?id=eq.${edgeData.id}&select=title,duration,difficulty,release_date`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
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

  return NextResponse.json({
    ...edgeData,
    title: detail.title ?? null,
    duration: detail.duration ?? null,
    difficulty: detail.difficulty ?? null,
    releaseDate: detail.release_date ?? null,
  });
}
