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

  const testSheets = [
    {
      id: "issue-sheet-1",
      title: "Issue Publication Sheet",
      rows: [
        { id: "row-1", title: "Front Cover", section: "Front", layout: "Xtian", writer: "", graphics: "", online: "", page: "1", progress: "In Progress" }
      ]
    }
  ];

  const { error: upsertErr } = await anon.from("app_state").upsert({
    id: "issue_sheets",
    data: testSheets,
    updated_at: new Date().toISOString()
  });

  console.log("Upsert issue_sheets into app_state as authenticated user:", upsertErr?.message || "success");

  const { data, error: selectErr } = await anon.from("app_state").select("*").eq("id", "issue_sheets").maybeSingle();
  console.log("Select issue_sheets from app_state:", selectErr?.message || "success", data);
}

run();
