import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(sbUrl!, sbKey!);

async function seed() {
  console.log("Starting seed of members and initial data to Supabase...");

  // 1. Fetch profiles to get user_ids
  const { data: profiles, error: pErr } = await sb.from("profiles").select("*");
  if (pErr || !profiles) {
    console.error("Failed to fetch profiles:", pErr);
    return;
  }
  const emailToProfile = new Map(profiles.map(p => [p.email.toLowerCase(), p]));

  // 2. Read db.json
  const db = JSON.parse(fs.readFileSync("db.json", "utf-8"));

  // 3. Upsert members
  for (const m of db.members) {
    const prof = emailToProfile.get(m.email.toLowerCase());
    if (!prof) {
      console.warn(`No profile found for ${m.email}`);
      continue;
    }

    const memberRow = {
      id: prof.id, // Use profile.id as member.id for 1:1 clean relation
      user_id: prof.id,
      name: m.name,
      display_name: m.displayName,
      role: m.role,
      college: m.college,
      email: m.email,
      contact: m.contact,
      status_sem1: m.statusSem1,
      status_sem2: m.statusSem2,
      type: m.type,
      xp: m.xp || 0,
      level: m.level || 1,
      completed_tasks: m.completedTasks || 0,
      current_sem_pubs: m.currentSemPubs || 0,
      schedule: typeof m.schedule === "string" ? { note: m.schedule } : m.schedule,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from("members").upsert(memberRow, { onConflict: "id" });
    if (error) {
      console.error(`Error inserting member ${m.email}:`, error.message);
    } else {
      console.log(`Member upserted: ${m.name} (${m.email})`);
    }
  }

  // 4. Seed announcement if empty
  const { data: existingAnn } = await sb.from("announcements").select("id").limit(1);
  if (!existingAnn || existingAnn.length === 0) {
    const defaultAnn = {
      id: "00000000-0000-4000-a000-000000000001",
      title: "Welcome to MKule Layout Desk 2026",
      content: "New semester workflow activated. Layout staffers and probis please submit your weekly schedules in the Team Directory.",
      author: "Rodriguez, Christian (Layout Editor)",
      date: "2026-07-01",
      created_at: new Date().toISOString()
    };
    const { error: annErr } = await sb.from("announcements").insert(defaultAnn);
    if (annErr) console.error("Error inserting announcement:", annErr.message);
    else console.log("Seeded announcement.");
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
