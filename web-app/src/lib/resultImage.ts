import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESULT_IMAGE_BUCKET = process.env.RESULT_IMAGE_BUCKET ?? "generated-results";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

let adminClient: SupabaseClient | null = null;
let openaiClient: OpenAI | null = null;

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

const generateAndStore = async (
  client: SupabaseClient,
  riddleId: number,
  objectPath: string,
  question: string,
  score: number,
  difficulty?: string | null,
) => {
  const openai = getOpenAIClient();
  if (!openai) return null;

  const description = `Illustration lumineuse et stylisée représentant l'esprit de l'énigme suivante : \n"${question}". \nScore obtenu : ${score}.\n` +
    (difficulty ? `Niveau : ${difficulty}.\n` : "") +
    "Style moderne, ambiance cérébrale, sans texte ni chiffre.";

  const imageResponse = await openai.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt: description,
    size: "1024x1024",
    response_format: "b64_json",
  });

  const base64 = imageResponse.data[0]?.b64_json;
  if (!base64) return null;
  const buffer = Buffer.from(base64, "base64");

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

export const ensureResultImage = async (
  riddleId: number,
  question: string,
  score: number,
  difficulty?: string | null,
  options?: { eager?: boolean },
): Promise<string | null> => {
  const client = getAdminClient();
  if (!client) return null;

  await ensureBucket(client);

  const today = new Date().toISOString().slice(0, 10);
  const objectPath = buildObjectPath(riddleId, today);

  try {
    const list = await listExistingForDay(client, riddleId, today);
    if (!list.error && list.data?.some((file) => file.name === `${today}.png`)) {
      return signObjectUrl(client, objectPath);
    }
  } catch (error) {
    console.error("Unable to inspect storage bucket", error);
  }

  const eager = options?.eager ?? true;

  if (!eager) {
    void generateAndStore(client, riddleId, objectPath, question, score, difficulty).catch((error) => {
      console.error("Deferred result image generation failed", error);
    });
    return null;
  }

  try {
    return await generateAndStore(client, riddleId, objectPath, question, score, difficulty);
  } catch (error) {
    console.error("Failed to generate result image", error);
    return null;
  }
};
