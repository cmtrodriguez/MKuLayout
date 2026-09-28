import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function testAuthRealtime() {
  console.log("Logging in as ctrodriguez2@up.edu.ph...");
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }
  console.log("Logged in successfully! User ID:", authData.user.id);

  console.log("Subscribing to tasks realtime with auth token...");
  let received = false;

  const channel = client
    .channel("test-auth-tasks-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      (payload) => {
        console.log("REALTIME EVENT RECEIVED!", payload.eventType, payload.new);
        received = true;
      }
    )
    .subscribe(async (status) => {
      console.log("Channel status:", status);
      if (status === "SUBSCRIBED") {
        console.log("Inserting a task as admin...");
        const taskId = "33333333-3333-4333-8333-333333333333";
        const { error } = await admin.from("tasks").insert({
          id: taskId,
          title: "Auth Realtime Test Task",
          progress: "Not Started"
        });
        if (error) {
          console.error("Insert error:", error.message);
        } else {
          console.log("Task inserted, waiting 5 seconds for realtime event...");
          setTimeout(async () => {
            await admin.from("tasks").delete().eq("id", taskId);
            console.log("Realtime test completed. Event received?", received);
            process.exit(0);
          }, 5000);
        }
      }
    });
}

testAuthRealtime();
