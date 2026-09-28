import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(sbUrl!, sbKey!);

async function run() {
  // Test basic read and write permissions on the tables with service role
  console.log("Testing tasks insert...");
  const testId = "11111111-1111-4111-8111-111111111111";
  const { data: tData, error: tErr } = await sb.from("tasks").insert({
    id: testId,
    title: "Test Probe Task",
    type_of_release: "Online Article",
    type_of_content: "feats artx",
    progress: "Not Started",
    priority: "Medium"
  }).select();
  console.log("Insert task result:", tData, tErr);

  if (!tErr) {
    console.log("Deleting probe task...");
    await sb.from("tasks").delete().eq("id", testId);
  }

  // Test anon client reading profiles and tasks
  const anonSb = createClient(sbUrl!, process.env.VITE_SUPABASE_ANON_KEY!);
  const { data: aData, error: aErr } = await anonSb.from("profiles").select("*");
  console.log("Anon select profiles:", aData?.length, aErr?.message || "success");

  const { data: aTasks, error: aTasksErr } = await anonSb.from("tasks").select("*");
  console.log("Anon select tasks:", aTasks?.length, aTasksErr?.message || "success");
}

run().catch(console.error);
