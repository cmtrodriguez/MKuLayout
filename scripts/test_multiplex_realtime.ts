import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function testSingleChannelMultiplex() {
  await client.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  const eventsReceived: Record<string, boolean> = {
    tasks: false,
    task_comments: false,
    notifications: false,
    personal_calendar_events: false,
    calendar_events: false,
    polls: false,
    announcements: false
  };

  const channel = client.channel("app-changes");

  for (const table of Object.keys(eventsReceived)) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        console.log(`>>> REALTIME RECEIVED for table: ${table} [${payload.eventType}]`);
        eventsReceived[table] = true;
      }
    );
  }

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      console.log("Channel subscription status:", status);
      if (status === "SUBSCRIBED") {
        resolve();
      }
    });
  });

  console.log("Channel SUBSCRIBED! Performing inserts...");
  const testId = "99999999-1111-4111-8111-111111111111";
  const taskId = "99999999-2222-4222-8222-222222222222";

  // 1. Task
  await admin.from("tasks").insert({ id: taskId, title: "Test Task" });

  // 2. Task Comment
  await admin.from("task_comments").insert({
    id: testId,
    task_id: taskId,
    author_name: "Xtian",
    author_email: "ctrodriguez2@up.edu.ph",
    text: "Test comment",
    timestamp: new Date().toISOString()
  });

  // 3. Notification
  await admin.from("notifications").insert({
    id: testId,
    title: "Test Notif",
    message: "Test message",
    type: "info",
    timestamp: new Date().toISOString()
  });

  // 4. Personal Calendar Event
  await admin.from("personal_calendar_events").insert({
    id: testId,
    user_email: "ctrodriguez2@up.edu.ph",
    title: "Test Event",
    date: "2026-07-20"
  });

  // 5. Calendar Event
  await admin.from("calendar_events").insert({
    id: testId,
    title: "Team Meeting",
    start_at: new Date().toISOString(),
    type: "meeting"
  });

  // 6. Poll
  await admin.from("polls").insert({
    id: testId,
    question: "Design test?",
    category: "design",
    anonymous: false,
    active: true,
    creator: "ctrodriguez2@up.edu.ph"
  });

  // 7. Announcement
  await admin.from("announcements").insert({
    id: testId,
    title: "Test Announcement",
    content: "Content"
  });

  console.log("Inserts complete. Waiting 5s for realtime events...");
  await new Promise(r => setTimeout(r, 5000));

  console.log("Final events received summary:", eventsReceived);

  // Clean up
  await admin.from("task_comments").delete().eq("id", testId);
  await admin.from("tasks").delete().eq("id", taskId);
  await admin.from("notifications").delete().eq("id", testId);
  await admin.from("personal_calendar_events").delete().eq("id", testId);
  await admin.from("calendar_events").delete().eq("id", testId);
  await admin.from("polls").delete().eq("id", testId);
  await admin.from("announcements").delete().eq("id", testId);

  process.exit(0);
}

testSingleChannelMultiplex();
