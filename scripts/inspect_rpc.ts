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
  console.log("RPC paths in OpenAPI spec:");
  for (const p of Object.keys(spec.paths || {})) {
    if (p.startsWith('/rpc/')) {
      console.log(p);
    }
  }
}

run().catch(console.error);
