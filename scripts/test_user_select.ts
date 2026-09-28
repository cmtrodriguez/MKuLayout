import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function run() {
  await client.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  const tables = [
    "profiles",
    "tasks",
    "task_comments",
    "personal_calendar_events",
    "calendar_events",
    "polls",
    "poll_options",
    "notifications",
    "announcements",
    "members",
    "app_state"
  ];

  console.log("Checking SELECT permissions as authenticated user...");
  for (const t of tables) {
    const { data, error } = await client.from(t).select("*").limit(1);
    if (error) {
      console.log(` - ${t}: ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(` - ${t}: OK (can select, returned ${data?.length} rows)`);
    }
  }

  console.log("\nChecking INSERT permissions as authenticated user...");
  // Test insert into personal_calendar_events
  const testPEventId = "88888888-8888-4888-8888-888888888888";
  const { data: peData, error: peErr } = await client.from("personal_calendar_events").insert({
    id: testPEventId,
    user_email: "ctrodriguez2@up.edu.ph",
    title: "Test Insert",
    date: "2026-07-25"
  }).select();
  console.log("personal_calendar_events insert:", peErr ? `ERROR: ${peErr.message}` : "OK");
  if (!peErr) {
    await client.from("personal_calendar_events").delete().eq("id", testPEventId);
  }

  // Test insert into task_comments
  const testTaskId = "77777777-7777-4777-8777-777777777777";
  await admin.from("tasks").insert({ id: testTaskId, title: "Test Parent" });
  const testCId = "66666666-6666-4666-8666-666666666666";
  const { data: cData, error: cErr } = await client.from("task_comments").insert({
    id: testCId,
    task_id: testTaskId,
    author_name: "Xtian",
    author_email: "ctrodriguez2@up.edu.ph",
    text: "Test comment",
    timestamp: new Date().toISOString()
  }).select();
  console.log("task_comments insert:", cErr ? `ERROR: ${cErr.message}` : "OK");
  if (!cErr) {
    await client.from("task_comments").delete().eq("id", testCId);
  }
  await admin.from("tasks").delete().eq("id", testTaskId);
}

run().catch(console.error);
