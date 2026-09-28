import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anon = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  await anon.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  // Test full task insert and select
  const taskId = crypto.randomUUID();
  const { data: insertedTask, error: insertErr } = await anon.from("tasks").insert({
    id: taskId,
    title: "Test Full Task Insert",
    type_of_release: "Online Article",
    type_of_content: "feats artx",
    writer: "Christian",
    illus_layout: "Xtian",
    progress: "Not Started",
    priority: "Medium",
    release_date: "2026-10-01",
    notes: "Testing full persistence",
    files: ["sample.pdf"],
    reviewers: ["Ronz"]
  }).select().single();

  console.log("Task inserted:", insertErr?.message || "success", insertedTask?.id);

  // Test task update
  const { error: updateErr } = await anon.from("tasks").update({
    progress: "In Progress",
    notes: "Updated notes"
  }).eq("id", taskId);

  console.log("Task updated:", updateErr?.message || "success");

  // Test task delete
  const { error: delErr } = await anon.from("tasks").delete().eq("id", taskId);
  console.log("Task deleted:", delErr?.message || "success");
}

run();
