import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type GenericSupabaseClient = SupabaseClient<unknown, "public", unknown>;

const createClient = async (): Promise<GenericSupabaseClient> => {
  const cookieStore = await cookies();
  return createRouteHandlerClient({ cookies: () => cookieStore });
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const riddleId = Number.parseInt(searchParams.get("riddleId") ?? "", 10);

    if (Number.isNaN(riddleId) || riddleId <= 0) {
      return NextResponse.json({ error: "riddleId requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: existingScore, error: scoreError } = await supabase
      .from("scores")
      .select("score,duration,msg_count")
      .eq("user_id", session.user.id)
      .eq("riddle_id", riddleId)
      .maybeSingle();

    if (scoreError) {
      throw new Error(scoreError.message);
    }

    if (!existingScore) {
      return NextResponse.json({ hasScore: false });
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
      .lt("score", existingScore.score ?? 0);

    const equalResponse = await supabase
      .from("scores")
      .select("score", { count: "exact", head: true })
      .eq("riddle_id", riddleId)
      .eq("score", existingScore.score ?? 0);

    const totalPlayers = totalResponse.count ?? 0;
    const beatenPlayers = lowerResponse.count ?? 0;
    const tiedPlayers = equalResponse.count ?? 0;
    const rankingPercent = totalPlayers > 0
      ? Math.round(((beatenPlayers + tiedPlayers / 2) / totalPlayers) * 100)
      : 0;

    return NextResponse.json({
      hasScore: true,
      score: existingScore.score ?? 0,
      duration: existingScore.duration ?? null,
      msgCount: existingScore.msg_count ?? null,
      totalPlayers,
      beatenPlayers,
      rankingPercent,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}
