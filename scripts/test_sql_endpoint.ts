import dotenv from "dotenv";
dotenv.config();

const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEndpoint(url: string, body?: any) {
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        'apikey': sbKey!,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    console.log(`${url} -> status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 200)}`);
  } catch (e: any) {
    console.log(`${url} -> fetch error: ${e.message}`);
  }
}

async function run() {
  await testEndpoint(`${sbUrl}/pg/query`, { query: 'SELECT 1;' });
  await testEndpoint(`${sbUrl}/rest/v1/rpc/rls_auto_enable`, {});
  await testEndpoint(`https://api.supabase.com/v1/projects/egqordbanppccxgeoprg/database/query`, { query: 'SELECT 1;' });
}

run();
