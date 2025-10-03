import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
const RIDDLE_IMAGE_BUCKET = process.env.RIDDLE_IMAGE_BUCKET ?? "riddle-images";

let adminClient: SupabaseClient | null = null;
let openaiClient: OpenAI | null = null;

const log = (...args: unknown[]) => {
  console.log("[RiddleImage]", ...args);
};

const getAdminClient = () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    log("Missing Supabase credentials. Cannot ensure riddle image.");
    return null;
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  }
  return adminClient;
};

const getOpenAIClient = () => {
  if (!OPENAI_API_KEY) {
    log("Missing OPENAI_API_KEY. Skipping illustration generation.");
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
};

const ensureBucket = async (client: SupabaseClient) => {
  const { data, error } = await client.storage.listBuckets();
  if (error) {
    log("Unable to list buckets", error.message);
    return;
  }
  if (!data?.some((bucket) => bucket.name === RIDDLE_IMAGE_BUCKET)) {
    await client.storage.createBucket(RIDDLE_IMAGE_BUCKET, { public: false });
    log("Created riddle image bucket", { bucket: RIDDLE_IMAGE_BUCKET });
  }
};

const signObjectUrl = async (client: SupabaseClient, path: string) => {
  const { data, error } = await client.storage
    .from(RIDDLE_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (error) {
    if (!/not found/i.test(error.message)) {
      log("Failed to sign existing illustration", { path, error: error.message });
    }
    return null;
  }
  return data?.signedUrl ?? null;
};

const normalisePath = (rawPath: string | null | undefined, riddleId: number) => {
  const fallback = `riddles/${riddleId}.png`;
  if (!rawPath) return fallback;
  const trimmed = rawPath.trim().replace(/^\/+/, "");
  if (!trimmed) return fallback;
  const bucketPrefix = `${RIDDLE_IMAGE_BUCKET}/`;
  const cleaned = trimmed.startsWith(bucketPrefix) ? trimmed.slice(bucketPrefix.length) : trimmed;
  if (!/\.(png|jpe?g|webp)$/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
};

const buildPrompt = (question: string) =>
  [
    "Cartoon-style illustration inspired by the following brain teaser:",
    question.trim().replace(/\s+/g, " ") || "A mysterious riddle",
    "Vibrant colors, whimsical atmosphere, expressive characters, no text.",
  ].join("\n");

const generateImageBuffer = async (question: string) => {
  const openai = getOpenAIClient();
  if (!openai) return null;

  log("Generating illustration via OpenAI", { model: OPENAI_IMAGE_MODEL });
  try {
    const response = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: buildPrompt(question),
      size: "1024x1024",
    });

    const base64 = response.data[0]?.b64_json;
    if (base64) {
      return Buffer.from(base64, "base64");
    }

    const remoteUrl = response.data[0]?.url;
    if (remoteUrl) {
      const remoteResponse = await fetch(remoteUrl);
      if (!remoteResponse.ok) {
        log("Failed to download illustration from signed URL", {
          status: remoteResponse.status,
        });
        return null;
      }
      const arrayBuffer = await remoteResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    log("OpenAI response missing image data");
    return null;
  } catch (error) {
    log("OpenAI illustration generation threw", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

type EnsureResult = {
  url: string | null;
  imagePath: string | null;
  generated: boolean;
};

export const ensureRiddleImage = async (
  riddleId: number,
  question: string,
  currentPath?: string | null,
): Promise<EnsureResult> => {
  const client = getAdminClient();
  if (!client) {
    return { url: null, imagePath: currentPath ?? null, generated: false };
  }

  await ensureBucket(client);

  const rawTrimmedPath = currentPath ? currentPath.trim().replace(/^\/+/, "") : null;
  const objectPath = normalisePath(currentPath, riddleId);
  const shouldPersistPath = !rawTrimmedPath || rawTrimmedPath !== objectPath;
  log("Ensuring illustration", { riddleId, objectPath });

  const existingUrl = await signObjectUrl(client, objectPath);
  if (existingUrl) {
    log("Found existing illustration", { riddleId, objectPath });
    if (shouldPersistPath) {
      await client.from("riddles").update({ image_path: objectPath }).eq("id", riddleId);
    }
    return { url: existingUrl, imagePath: objectPath, generated: false };
  }

  if (!question || !question.trim()) {
    log("Question missing, cannot generate illustration", { riddleId });
    return { url: null, imagePath: currentPath ?? null, generated: false };
  }

  const buffer = await generateImageBuffer(question);
  if (!buffer) {
    log("OpenAI generation failed", { riddleId });
    return { url: null, imagePath: currentPath ?? null, generated: false };
  }

  const upload = await client.storage
    .from(RIDDLE_IMAGE_BUCKET)
    .upload(objectPath, buffer, {
      cacheControl: "86400",
      contentType: "image/png",
      upsert: false,
    });

  if (upload.error) {
    log("Upload failed", { riddleId, error: upload.error.message });
    // If the object already exists we can try signing it again (race condition)
    const fallbackUrl = await signObjectUrl(client, objectPath);
    if (fallbackUrl) {
      return { url: fallbackUrl, imagePath: objectPath, generated: false };
    }
    return { url: null, imagePath: currentPath ?? null, generated: false };
  }

  log("Illustration uploaded", { riddleId, path: objectPath });

  const { error: updateError } = await client
    .from("riddles")
    .update({ image_path: objectPath })
    .eq("id", riddleId);
  if (updateError) {
    log("Failed to persist image path", { riddleId, error: updateError.message });
  }

  const signedUrl = await signObjectUrl(client, objectPath);
  if (!signedUrl) {
    return { url: null, imagePath: objectPath, generated: true };
  }

  return { url: signedUrl, imagePath: objectPath, generated: true };
};
