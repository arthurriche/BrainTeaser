import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { RESOURCE_CATALOG, type ResourceSlug } from "@/lib/premium";

type ResourceOrderRow = {
  resource_slug: string | null;
  download_url: string | null;
  status: string | null;
  fulfilled_at: string | null;
};

const jsonError = (message: string, status = 500) => NextResponse.json({ error: message }, { status });

const isResourceSlug = (value: string): value is ResourceSlug =>
  Object.hasOwn(RESOURCE_CATALOG, value as ResourceSlug);

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ resources: [] });
  }

  const { data, error } = await supabase
    .from("resource_orders")
    .select("resource_slug, download_url, status, fulfilled_at")
    .eq("user_id", session.user.id)
    .eq("status", "paid");

  if (error) {
    console.error("[Resources] Failed to list orders", error);
    return jsonError("Unable to fetch resource orders");
  }

  const resources = Array.isArray(data)
    ? data
        .filter((row): row is ResourceOrderRow =>
          Boolean(row) && typeof row === "object" && typeof row.resource_slug === "string",
        )
        .filter((row) => row.resource_slug && isResourceSlug(row.resource_slug))
        .map((row) => ({
          slug: row.resource_slug as ResourceSlug,
          downloadUrl: typeof row.download_url === "string" ? row.download_url : null,
          fulfilledAt: typeof row.fulfilled_at === "string" ? row.fulfilled_at : null,
        }))
    : [];

  return NextResponse.json({ resources });
}
