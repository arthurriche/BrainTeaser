import type { SupabaseClient } from "@supabase/supabase-js";

type PremiumAccessRow = {
  access_type: "single" | "subscription";
  riddle_id: number | null;
  valid_until: string | null;
};

export type PremiumAccessEvaluation = {
  unlocked: boolean;
  type: "single" | "subscription" | null;
  validUntil: string | null;
};

const isRowValid = (value: unknown): value is PremiumAccessRow => {
  if (!value || typeof value !== "object") return false;
  if (!("access_type" in value)) return false;
  const rawType = (value as { access_type?: unknown }).access_type;
  if (rawType !== "single" && rawType !== "subscription") return false;
  return true;
};

const mapRow = (row: PremiumAccessRow) => {
  const { access_type, riddle_id, valid_until } = row;
  return {
    accessType: access_type,
    riddleId: typeof riddle_id === "number" ? riddle_id : null,
    validUntil: typeof valid_until === "string" ? valid_until : null,
  };
};

export const evaluatePremiumAccess = async (
  supabase: SupabaseClient,
  userId: string,
  riddleId: number,
): Promise<PremiumAccessEvaluation> => {
  const { data, error } = await supabase
    .from("premium_access")
    .select("access_type,riddle_id,valid_until")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data.filter(isRowValid).map(mapRow) : [];
  if (rows.length === 0) {
    return { unlocked: false, type: null, validUntil: null };
  }

  const now = Date.now();
  const subscription = rows.find((row) => row.accessType === "subscription" && row.validUntil);
  const hasSubscription =
    Boolean(subscription) && new Date(subscription!.validUntil ?? "").getTime() > now;

  if (hasSubscription) {
    return {
      unlocked: true,
      type: "subscription",
      validUntil: subscription?.validUntil ?? null,
    };
  }

  const hasSingle = rows.some(
    (row) => row.accessType === "single" && row.riddleId === riddleId,
  );

  if (hasSingle) {
    return { unlocked: true, type: "single", validUntil: null };
  }

  return { unlocked: false, type: null, validUntil: null };
};
