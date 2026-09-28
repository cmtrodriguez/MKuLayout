import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await sb.from("members").select("*");
  console.log("members table rows:", data?.length, error?.message || "");
  if (data && data.length > 0) {
    console.log("First member:", data[0]);
  }
}

run();
