import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { seededUuid } from "../src/lib/seededUuid";

// Seeds the layout team's prior 2026 output into the tasks table as COMPLETED
// tasks so they land in each assignee's Task Archive and are reflected in the
// per-member semester pubmat count and the whole-team Workload Tracker on the
// editor/deputy dashboard. Idempotent: ids are deterministic (seededUuid) and
// rows are upserted, so re-running never duplicates.
//
// Usage: npx tsx scripts/seed_archived_tasks.ts

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const sb = createClient(sbUrl, sbKey);

const EMAILS: Record<string, string> = {
  "Ronz Abad": "rcabad1@up.edu.ph",
  "Aris Musni": "ctmusni@up.edu.ph",
  "Jam Roldan": "lfroldan@up.edu.ph",
  "Xtian Rodriguez": "ctrodriguez2@up.edu.ph",
  "Carl Donor": "cndonor@up.edu.ph",
  "Issa Sorio": "casorio@up.edu.ph",
  "Zoe Atienza": "zatienza@up.edu.ph",
  "Eve Magno": "jcmagno1@up.edu.ph",
  "Iris Dizon": "ibdizon@up.edu.ph",
};

const MONTHS: Record<string, string> = {
  Aug: "AUGUST",
  Sept: "SEPTEMBER",
};

type Row = [release: string, category: string, assignee: string, title: string, date: string];

// Format: Online/Issue - Category - Assignee - Title - Date (all 2026)
const ARCHIVE: Row[] = [
  ["Online", "Iskotistiks", "Ronz Abad", "Fisherfolk", "Aug 13"],
  ["Online", "Opinion", "Aris Musni", "APE", "Aug 15"],
  ["Online", "News", "Jam Roldan", "DevStud", "Aug 17"],
  ["Issue", "News", "Xtian Rodriguez", "Pax Silica", "Aug 18"],
  ["Issue", "Iskotistiks", "Carl Donor", "Pax Silica", "Aug 18"],
  ["Issue", "Iskotistiks", "Xtian Rodriguez", "Magna Carta", "Aug 18"],
  ["Issue", "Culture", "Xtian Rodriguez", "Sinag", "Aug 18"],
  ["Issue", "Culture", "Xtian Rodriguez", "Balarila", "Aug 18"],
  ["Issue", "Features", "Xtian Rodriguez", "Nueva Sikat", "Aug 18"],
  ["Issue", "Features", "Xtian Rodriguez", "AI Confidant", "Aug 18"],
  ["Issue", "Features", "Xtian Rodriguez", "Kubrador", "Aug 18"],
  ["Online", "Logo", "Xtian Rodriguez", "MKule 26-27", "Aug 10"],
  ["Online", "Header", "Xtian Rodriguez", "MKule 26-27", "Aug 10"],
  ["Online", "Iskotistiks", "Carl Donor", "Pax Silica", "Aug 19"],
  ["Online", "Opinion", "Ronz Abad", "MST Well", "Aug 20"],
  ["Online", "Kultura", "Jam Roldan", "Sinag", "Aug 21"],
  ["Online", "Iskotistiks", "Xtian Rodriguez", "Magna Carta", "Aug 22"],
  ["Online", "Features", "Xtian Rodriguez", "Kubrador", "Aug 23"],
  ["Online", "Opinion", "Ronz Abad", "MST Malubhang", "Aug 23"],
  ["Online", "Features", "Issa Sorio", "AI Confidant", "Aug 24"],
  ["Online", "Culture", "Issa Sorio", "Balarila", "Aug 26"],
  ["Online", "Opinion", "Ronz Abad", "That's My Why", "Aug 28"],
  ["Online", "News", "Jam Roldan", "Press Freedom Day", "Aug 30"],
  ["Online", "Logo", "Xtian Rodriguez", "Chancy Selex", "Sept 4"],
  ["Online", "Header", "Xtian Rodriguez", "Chancy Selex", "Sept 4"],
  ["Online", "News", "Ronz Abad", "Villegas", "Sept 9"],
  ["Online", "News", "Aris Musni", "Responsibili-Tee", "Sept 15"],
  ["Online", "News", "Ronz Abad", "Drug War Victims", "Sept 17"],
  ["Online", "News", "Xtian Rodriguez", "Police Officer", "Sept 17"],
  ["Online", "Logo", "Eve Magno", "ML54", "Sept 20"],
  ["Online", "News", "Ronz Abad", "Reali-Tee", "Sept 20"],
  ["Online", "Culture", "Jam Roldan", "LuzViMin", "Sept 22"],
  ["Issue", "Features", "Xtian Rodriguez and Ronz Abad", "DESAP", "Sept 24"],
  ["Issue", "Features", "Aris Musni and Xtian Rodriguez", "Juvenile", "Sept 24"],
  ["Issue", "Culture", "Jam Roldan", "LuzViMin", "Sept 24"],
  ["Issue", "Culture", "Xtian Rodriguez", "Baha Bahagi", "Sept 24"],
  ["Issue", "Culture", "Zoe Atienza", "Scho-Hardships", "Sept 24"],
  ["Issue", "Editorial", "Issa Sorio", "Magkakawangis", "Sept 24"],
  ["Online", "Opinion", "Jam Roldan", "One DOST for Who?", "Sept 24"],
  ["Online", "News", "Ronz Abad", "Moro Residents", "Sept 24"],
  ["Online", "News", "Ronz Abad", "ML Mob", "Sept 25"],
  ["Online", "Features", "Ronz Abad", "DESAP", "Sept 27"],
  ["Online", "News", "Iris Dizon", "2027 NEP", "Sept 28"],
  ["Online", "Culture", "Zoe Atienza", "Scho-Hardships", "Sept 28"],
  ["Online", "Features", "Aris Musni", "Juvenile", "Sept 29"],
  ["Online", "Culture", "Xtian Rodriguez", "Baha Bahagi", "Sept 30"],
];

function toIsoDate(date: string): string {
  const [mon, day] = date.split(" ");
  const monthNum = mon === "Aug" ? 8 : mon === "Sept" ? 9 : 1;
  return new Date(Date.UTC(2026, monthNum - 1, Number(day), 12, 0, 0)).toISOString();
}

// "Xtian Rodriguez and Ronz Abad" -> canonical display label used by the app's
// name-matching filters, plus the primary assignee email.
function resolveAssignee(raw: string): { label: string; email: string } {
  const names = raw.split(/\s+and\s+/i).map((n) => n.trim()).filter(Boolean);
  const label = names.join(", ");
  const email = EMAILS[names[0]] || "";
  return { label, email };
}

async function seed() {
  console.log(`Seeding ${ARCHIVE.length} archived tasks into Supabase...`);

  let ok = 0;
  let failed = 0;

  for (const [release, category, rawAssignee, title, date] of ARCHIVE) {
    const { label, email } = resolveAssignee(rawAssignee);
    const typeOfRelease = release === "Issue" ? "Issue Article" : "Online Article";
    const releaseDate = `${MONTHS[date.split(" ")[0]]} ${date.split(" ")[1]}`;
    const iso = toIsoDate(date);
    const id = seededUuid(`archive-task-${release}-${category}-${label}-${title}-${date}`.toLowerCase());

    const row = {
      id,
      title,
      type_of_release: typeOfRelease,
      type_of_content: category,
      writer: "",
      illus_layout: label,
      graphics: "",
      progress: "Completed",
      writeup: "",
      priority: "Medium",
      release_date: releaseDate,
      time: null,
      estimated_hours: null,
      actual_hours: null,
      notes: `Archived prior output (${release}, ${category}) — ${rawAssignee}.`,
      reviewers: [],
      files: [],
      comments_count: 0,
      revision_count: 0,
      last_updated: iso,
      canva_link: null,
      pubmat_link: null,
      draft_link: null,
      added_to_layout: null,
      graphics_illus: null,
      online_handler: null,
      is_pending_confirmation: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from("tasks").upsert(row, { onConflict: "id" });
    if (error) {
      failed++;
      console.error(`  x ${release} ${title} (${label}): ${error.message}`);
    } else {
      ok++;
      console.log(`  + ${release} - ${category} - ${label} - ${title} - ${releaseDate} [${email || "no email"}]`);
    }
  }

  console.log(`\nDone. ${ok} upserted, ${failed} failed.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
