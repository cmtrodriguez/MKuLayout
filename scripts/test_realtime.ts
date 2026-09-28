import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function testRealtime() {
  console.log("Subscribing to tasks realtime...");
  let received = false;

  const channel = client
    .channel("test-tasks-channel")
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
        console.log("Inserting a task to test realtime delivery...");
        const taskId = "22222222-2222-4222-8222-222222222222";
        const { error } = await admin.from("tasks").insert({
          id: taskId,
          title: "Realtime Test Task",
          progress: "Not Started"
        });
        if (error) {
          console.error("Insert error:", error.message);
        } else {
          console.log("Task inserted, waiting 3 seconds for realtime event...");
          setTimeout(async () => {
            await admin.from("tasks").delete().eq("id", taskId);
            console.log("Realtime test completed. Event received?", received);
            process.exit(0);
          }, 3000);
        }
      }
    });
}

testRealtime();
