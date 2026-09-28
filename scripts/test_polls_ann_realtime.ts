import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(sbUrl!, anonKey!);
const admin = createClient(sbUrl!, serviceKey!);

async function run() {
  await client.auth.signInWithPassword({
    email: "ctrodriguez2@up.edu.ph",
    password: "K9mP2x7R"
  });

  const channel = client.channel("polls-and-announcements")
    .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, (p) => {
      console.log("REALTIME POLL EVENT:", p.eventType);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
      console.log("REALTIME ANNOUNCEMENT EVENT:", p.eventType);
    });

  await new Promise<void>((res) => {
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") res();
    });
  });

  console.log("Subscribed. Inserting poll and announcement...");
  const pId = "12121212-1212-4212-8212-121212121212";
  const aId = "13131313-1313-4313-8313-131313131313";

  await admin.from("polls").insert({
    id: pId,
    question: "Test Poll Realtime",
    category: "editorial",
    anonymous: false,
    active: true,
    creator: "ctrodriguez2@up.edu.ph"
  });

  await admin.from("announcements").insert({
    id: aId,
    title: "Test Announcement Realtime",
    content: "Content"
  });

  await new Promise(r => setTimeout(r, 3000));

  await admin.from("polls").delete().eq("id", pId);
  await admin.from("announcements").delete().eq("id", aId);

  await new Promise(r => setTimeout(r, 2000));
  process.exit(0);
}

run();
