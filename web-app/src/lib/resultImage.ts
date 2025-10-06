import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESULT_IMAGE_BUCKET = process.env.RESULT_IMAGE_BUCKET ?? "generated-results";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

let adminClient: SupabaseClient | null = null;
let openaiClient: OpenAI | null = null;
const runtimeImageCache = new Map<string, { day: string; url: string }>();
const logImage = (...args: unknown[]) => {
  console.log("[ResultImage]", ...args);
};

const cacheKeyFor = (riddleId: number, day: string, score: number, difficulty?: string | null) =>
  `${riddleId}-${day}-${Math.round(score)}-${difficulty ?? "_"}`;

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
  if (!data?.some((bucket) => bucket.name === RESULT_IMAGE_BUCKET)) {
    await client.storage.createBucket(RESULT_IMAGE_BUCKET, { public: false });
  }
};

const buildObjectPath = (riddleId: number, day: string) => `results/${riddleId}/${day}.png`;

const signObjectUrl = async (client: SupabaseClient, objectPath: string) => {
  const { data } = await client.storage
    .from(RESULT_IMAGE_BUCKET)
    .createSignedUrl(objectPath, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? null;
};

const listExistingForDay = async (client: SupabaseClient, riddleId: number, day: string) => {
  return client.storage
    .from(RESULT_IMAGE_BUCKET)
    .list(`results/${riddleId}`, { limit: 1, search: `${day}.png` });
};

const buildImagePrompt = (question: string, score: number, difficulty?: string | null) =>
  `Illustration lumineuse et stylisée représentant l'esprit de l'énigme suivante :\n"${question}".\nScore obtenu : ${score}.\n${difficulty ? `Niveau : ${difficulty}.\n` : ""}Style moderne, ambiance cérébrale, sans texte ni chiffre.`;

const generateImageBuffer = async (
  question: string,
  score: number,
  difficulty?: string | null,
): Promise<Buffer | null> => {
  const openai = getOpenAIClient();
  if (!openai) return null;

  logImage("Generating image via OpenAI", { model: OPENAI_IMAGE_MODEL, score, difficulty });
  const response = await openai.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt: buildImagePrompt(question, score, difficulty),
    size: "1024x1024",
    response_format: "b64_json",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) return null;
  return Buffer.from(base64, "base64");
};

const generateAndStore = async (
  client: SupabaseClient,
  riddleId: number,
  objectPath: string,
  question: string,
  score: number,
  difficulty?: string | null,
) => {
  const buffer = await generateImageBuffer(question, score, difficulty);
  if (!buffer) return null;

  logImage("Uploading generated image to Supabase", { riddleId, objectPath });
  const upload = await client.storage
    .from(RESULT_IMAGE_BUCKET)
    .upload(objectPath, buffer, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true,
    });

  if (upload.error) {
    console.error("Failed to upload generated image", upload.error);
    return null;
  }

  return signObjectUrl(client, objectPath);
};

const memoiseUrl = (cacheKey: string, day: string, url: string | null) => {
  if (!url) return url;
  runtimeImageCache.set(cacheKey, { day, url });
  return url;
};

type EnsureImageResult = {
  url: string | null;
  pending: boolean;
};

const buildResult = (url: string | null, pending = false): EnsureImageResult => ({ url, pending });

export const ensureResultImage = async (
  riddleId: number,
  question: string,
  score: number,
  difficulty?: string | null,
  options?: { eager?: boolean },
): Promise<EnsureImageResult> => {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = cacheKeyFor(riddleId, today, score, difficulty);
  const cached = runtimeImageCache.get(cacheKey);
  if (cached?.day === today) {
    logImage("Serving image from in-memory cache", { riddleId, day: today });
    return buildResult(cached.url, false);
  }

  const client = getAdminClient();
  const eager = options?.eager ?? true;

  if (!client) {
    logImage("No Supabase service role key available. Falling back to inline generation", {
      riddleId,
      eager,
    });
    if (!OPENAI_API_KEY) {
      logImage("Missing OPENAI_API_KEY. Returning null image.");
      return buildResult(null, false);
    }
    try {
      const buffer = await generateImageBuffer(question, score, difficulty);
      if (!buffer) return buildResult(null, false);
      const url = `data:image/png;base64,${buffer.toString("base64")}`;
      memoiseUrl(cacheKey, today, url);
      logImage("Inline image generated", { riddleId });
      return buildResult(url, false);
    } catch (error) {
      console.error("Inline image generation failed", error);
      return buildResult(null, false);
    }
  }

  await ensureBucket(client);
  const objectPath = buildObjectPath(riddleId, today);
  logImage("Ensuring result image", { riddleId, eager, objectPath, hasClient: Boolean(client) });

  try {
    const list = await listExistingForDay(client, riddleId, today);
    if (!list.error && list.data?.some((file) => file.name === `${today}.png`)) {
      const url = await signObjectUrl(client, objectPath);
      logImage("Found existing image in storage", { riddleId, objectPath, hasUrl: Boolean(url) });
      return buildResult(memoiseUrl(cacheKey, today, url), false);
    }
  } catch (error) {
    console.error("Unable to inspect storage bucket", error);
  }

  if (!eager) {
    logImage("Deferring image generation", { riddleId, objectPath });
    void generateAndStore(client, riddleId, objectPath, question, score, difficulty).then((url) => {
      if (url) {
        logImage("Deferred generation completed", { riddleId });
        memoiseUrl(cacheKey, today, url);
      }
    }).catch((error) => {
      console.error("Deferred result image generation failed", error);
    });
    return buildResult(cached?.url ?? null, true);
  }

  try {
    const url = await generateAndStore(client, riddleId, objectPath, question, score, difficulty);
    logImage("Generated image immediately", { riddleId, hasUrl: Boolean(url) });
    return buildResult(memoiseUrl(cacheKey, today, url), false);
  } catch (error) {
    console.error("Failed to generate result image", error);
    return buildResult(null, false);
  }
};
