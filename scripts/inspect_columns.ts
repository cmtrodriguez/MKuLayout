import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(sbUrl!, sbKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const tables = [
    'profiles',
    'tasks',
    'task_comments',
    'personal_calendar_events',
    'calendar_events',
    'polls',
    'poll_options',
    'notifications',
    'announcements'
  ];

  for (const t of tables) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    if (!error) {
      console.log(`\nTable '${t}' sample columns:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        // Try inserting and rolling back or querying with empty filter
        console.log("Empty table, testing select count or single query");
      }
    }
  }

  // Let's also check profiles row
  const { data: profs } = await sb.from('profiles').select('*');
  console.log("\nProfiles existing rows:", profs);
}

run().catch(console.error);
