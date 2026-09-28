import dns from "dns";

dns.lookup("db.egqordbanppccxgeoprg.supabase.co", (err, address, family) => {
  console.log("db.egqordbanppccxgeoprg.supabase.co:", address, err?.message);
});

dns.lookup("egqordbanppccxgeoprg.supabase.co", (err, address, family) => {
  console.log("egqordbanppccxgeoprg.supabase.co:", address, err?.message);
});
