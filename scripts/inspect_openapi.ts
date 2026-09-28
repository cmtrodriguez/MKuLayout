import dotenv from "dotenv";
dotenv.config();

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${sbUrl}/rest/v1/`, {
    headers: {
      apikey: sbKey!,
      Authorization: `Bearer ${sbKey}`
    }
  });

  const spec = await res.json();
  console.log("Definitions in OpenAPI spec:");
  if (spec.definitions) {
    for (const [name, def] of Object.entries(spec.definitions)) {
      console.log(`\n--- ${name} ---`);
      console.log(Object.keys((def as any).properties || {}));
    }
  }
}

run().catch(console.error);
