import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const pollId = "11111111-2222-3333-4444-555555555555";
  const optId1 = "11111111-2222-3333-4444-666666666666";
  const optId2 = "11111111-2222-3333-4444-777777777777";

  // Create poll
  await sb.from("polls").insert({
    id: pollId,
    question: "Which layout approach for cover?",
    category: "design",
    anonymous: false,
    active: true,
    creator: "ctrodriguez2@up.edu.ph"
  });

  // Create options
  await sb.from("poll_options").insert([
    { id: optId1, poll_id: pollId, text: "Minimalist Poster", votes: ["ctrodriguez2@up.edu.ph"] },
    { id: optId2, poll_id: pollId, text: "Collage Illustration", votes: [] }
  ]);

  // Query with nested relation
  const { data, error } = await sb.from("polls").select("*, poll_options(*)").eq("id", pollId);
  console.log("Nested poll query result:", JSON.stringify(data, null, 2), error?.message);

  // Clean up
  await sb.from("poll_options").delete().eq("poll_id", pollId);
  await sb.from("polls").delete().eq("id", pollId);
}

run();
