// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Create a client using env vars injected by the Supabase CLI / Edge Runtime
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Edge Function: GET today's riddle (id, question, signed image URL)
Deno.serve(async (_req) => {
  // Today in YYYY‑MM‑DD (UTC)
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Looking for riddle with release_date: ${today}`);

  // 1. Fetch today's riddle row
  const { data: riddle, error: riddleError } = await supabase
    .from("riddles")
    .select("id, question, image_path")
    .eq("release_date", today)
    .limit(1)
    .single();

  if (riddleError || !riddle) {
    return new Response(
      JSON.stringify({ error: riddleError?.message ?? "Riddle not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. For local development, serve images directly from the online db
  const imageURLs: Record<number, string> = {
    1: "https://psziiemacrkzqdutwvic.supabase.co/storage/v1/object/sign/riddle-images/1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hNjFjYjAwMS0xZGZmLTRiNDMtOWNjOS05MzVlODE2OGMxZGUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyaWRkbGUtaW1hZ2VzLzEucG5nIiwiaWF0IjoxNzUwOTc1Mzk4LCJleHAiOjE3ODI1MTEzOTh9.nlWMeIDVB6TMG-kwzjfvQjgb27nEvjBSXrvbr1B2FzE", 
    2: "https://psziiemacrkzqdutwvic.supabase.co/storage/v1/object/sign/riddle-images/2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hNjFjYjAwMS0xZGZmLTRiNDMtOWNjOS05MzVlODE2OGMxZGUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyaWRkbGUtaW1hZ2VzLzIucG5nIiwiaWF0IjoxNzUwOTc1NDQ0LCJleHAiOjE3ODI1MTE0NDR9.uayrJCt4OhrZfvsrfMwm6J8uK_7M8ShsnfruS9WFbZs", 
    5: "https://psziiemacrkzqdutwvic.supabase.co/storage/v1/object/sign/riddle-images/5.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hNjFjYjAwMS0xZGZmLTRiNDMtOWNjOS05MzVlODE2OGMxZGUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyaWRkbGUtaW1hZ2VzLzUucG5nIiwiaWF0IjoxNzUwOTc1NTIzLCJleHAiOjE3ODI1MTE1MjN9.6HIuCS83GK6Bui2BGyd1-27J96bE1KOl-FRMGi7mNGM"
  };

  // 3. Return the payload expected by the frontend
  const payload = {
    id: riddle.id,
    question: riddle.question,
    imageURL: imageURLs[riddle.id],
  };

  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
});


/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/riddle_today' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
