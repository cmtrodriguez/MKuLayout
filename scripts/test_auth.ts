import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(sbUrl!, anonKey!);
const adminClient = createClient(sbUrl!, serviceKey!);

const testUsers = [
  { email: "ctrodriguez2@up.edu.ph", pin: "K9mP2x7R" },
  { email: "rcabad1@up.edu.ph", pin: "V8n3Qw1Z" },
  { email: "lfroldan@up.edu.ph", pin: "P1h8Kv6F" },
  { email: "cndonor@up.edu.ph", pin: "D7kX9p2M" },
  { email: "jaumali2@up.edu.ph", pin: "U6y4Zb8K" },
  { email: "ctmusni@up.edu.ph", pin: "J7bX5r3Q" },
  { email: "casorio@up.edu.ph", pin: "C3g2Wn9S" },
  { email: "ztatienza@up.edu.ph", pin: "Z4mE8t9A" },
  { email: "jcmagno1@up.edu.ph", pin: "M5eX2q7G" },
  { email: "ibdizon@up.edu.ph", pin: "I9dB3w1Z" }
];

async function run() {
  console.log("Testing user sign-in with passwords...");
  for (const u of testUsers) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: u.email,
      password: u.pin
    });

    if (error) {
      console.log(`Failed to login ${u.email}: ${error.message}. Updating password with admin client...`);
      // Look up user id
      const { data: list } = await adminClient.auth.admin.listUsers();
      const match = list.users.find(x => x.email === u.email);
      if (match) {
        const { error: updErr } = await adminClient.auth.admin.updateUserById(match.id, {
          password: u.pin,
          email_confirm: true
        });
        if (updErr) {
          console.error(`  Failed to set password:`, updErr.message);
        } else {
          console.log(`  Successfully set password for ${u.email}`);
        }
      }
    } else {
      console.log(`Login SUCCESS for ${u.email}! User ID: ${data.user.id}`);
    }
  }
}

run().catch(console.error);
