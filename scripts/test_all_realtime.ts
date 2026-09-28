import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function testAllRealtime() {
  await client.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  const tables = [
    "task_comments",
    "notifications",
    "personal_calendar_events",
    "calendar_events",
    "polls",
    "announcements",
    "members"
  ];

  const results: Record<string, boolean> = {};

  for (const table of tables) {
    results[table] = false;
    const channel = client.channel(`test-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        results[table] = true;
      })
      .subscribe();
  }

  // Wait for subscriptions to be established
  await new Promise(r => setTimeout(r, 2000));

  // Perform inserts
  const testId = "44444444-4444-4444-8444-444444444444";
  
  // task_comments requires a task first
  const taskId = "55555555-5555-4555-8555-555555555555";
  await admin.from("tasks").insert({ id: taskId, title: "Parent Task" });
  await admin.from("task_comments").insert({
    id: testId,
    task_id: taskId,
    author_name: "Xtian",
    author_email: "ctrodriguez2@up.edu.ph",
    text: "Test comment",
    timestamp: new Date().toISOString()
  });

  await admin.from("notifications").insert({
    id: testId,
    title: "Test Notif",
    message: "Test message",
    type: "info",
    timestamp: new Date().toISOString()
  });

  await admin.from("personal_calendar_events").insert({
    id: testId,
    user_email: "ctrodriguez2@up.edu.ph",
    title: "Test Event",
    date: "2026-07-20"
  });

  await admin.from("calendar_events").insert({
    id: testId,
    title: "Team Meeting",
    start_at: new Date().toISOString(),
    type: "meeting"
  });

  await admin.from("polls").insert({
    id: testId,
    question: "Design test?",
    category: "design",
    anonymous: false,
    active: true,
    creator: "ctrodriguez2@up.edu.ph"
  });

  await admin.from("announcements").insert({
    id: testId,
    title: "Test Announcement",
    content: "Content"
  });

  await admin.from("members").insert({
    id: testId,
    name: "Probe Member",
    role: "Layout Probi"
  });

  console.log("Waiting 4s for events...");
  await new Promise(r => setTimeout(r, 4000));

  console.log("Realtime test results for all tables:", results);

  // Clean up
  await admin.from("task_comments").delete().eq("id", testId);
  await admin.from("tasks").delete().eq("id", taskId);
  await admin.from("notifications").delete().eq("id", testId);
  await admin.from("personal_calendar_events").delete().eq("id", testId);
  await admin.from("calendar_events").delete().eq("id", testId);
  await admin.from("polls").delete().eq("id", testId);
  await admin.from("announcements").delete().eq("id", testId);
  await admin.from("members").delete().eq("id", testId);

  process.exit(0);
}

testAllRealtime();
