import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await sb.from("tasks").insert({
    id: "task-12345",
    title: "Non-uuid test"
  });
  console.log("Insert non-uuid task ID:", error?.message || "success");
}

run();
