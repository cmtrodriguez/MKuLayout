import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const testId = "99999999-9999-4999-8999-999999999999";
  const { data, error } = await sb.from("tasks").insert({
    id: testId,
    title: "Test Task for Assignee ID",
    assignee_id: "ede887a3-1fa2-47af-803a-1988b728e16d"
  }).select();

  console.log("Insert with assignee_id:", data, error?.message);
  if (!error) {
    await sb.from("tasks").delete().eq("id", testId);
  }
}

run();
