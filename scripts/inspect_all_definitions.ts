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
  for (const [name, def] of Object.entries(spec.definitions || {})) {
    console.log(`\n=================== ${name} ===================`);
    const props = (def as any).properties || {};
    const required = (def as any).required || [];
    for (const [propName, prop] of Object.entries(props)) {
      const p = prop as any;
      console.log(`  ${propName}: ${p.type} (${p.format || ''}) ${required.includes(propName) ? 'REQUIRED' : 'optional'} [${p.description || ''}]`);
    }
  }
}

run().catch(console.error);
