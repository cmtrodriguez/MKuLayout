import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(sbUrl, sbKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log("Connecting to Supabase at:", sbUrl);

  // 1. List Auth Users
  const { data: userData, error: userError } = await sb.auth.admin.listUsers();
  if (userError) {
    console.error("Error listing users:", userError);
  } else {
    console.log(`Found ${userData.users.length} auth users:`);
    for (const u of userData.users) {
      console.log(` - ID: ${u.id}, Email: ${u.email}`);
    }
  }

  // 2. Check known tables
  const testTables = [
    'profiles',
    'app_state',
    'tasks',
    'task_comments',
    'personal_calendar_events',
    'calendar_events',
    'polls',
    'poll_options',
    'poll_votes',
    'notifications',
    'announcements',
    'issue_sheets'
  ];

  console.log("\nChecking existing tables:");
  for (const table of testTables) {
    const { data, error } = await sb.from(table).select('*').limit(1);
    if (error) {
      console.log(` Table '${table}': NOT FOUND or error (${error.code}: ${error.message})`);
    } else {
      console.log(` Table '${table}': EXISTS (sample count/row: ${data?.length})`);
    }
  }

  // 3. Inspect app_state content if exists
  const { data: stateData, error: stateError } = await sb.from('app_state').select('*');
  if (!stateError && stateData) {
    console.log("\napp_state table rows:", stateData.length);
    for (const row of stateData) {
      console.log(` - Row ID: ${row.id}, updated_at: ${row.updated_at}, has content: ${!!row.content}`);
      if (row.content) {
        const parsed = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        console.log(`   Keys in content:`, Object.keys(parsed));
        if (parsed.tasks) console.log(`   tasks count:`, parsed.tasks.length);
        if (parsed.members) console.log(`   members count:`, parsed.members.length);
        if (parsed.events) console.log(`   events count:`, parsed.events.length);
        if (parsed.polls) console.log(`   polls count:`, parsed.polls.length);
        if (parsed.comments) console.log(`   comments count:`, parsed.comments.length);
        if (parsed.notifications) console.log(`   notifications count:`, parsed.notifications.length);
        if (parsed.announcements) console.log(`   announcements count:`, parsed.announcements.length);
        if (parsed.issueSheets) console.log(`   issueSheets count:`, parsed.issueSheets.length);
        if (parsed.personalCalendarEvents) console.log(`   personalCalendarEvents count:`, parsed.personalCalendarEvents.length);
      }
    }
  }
}

run().catch(console.error);
