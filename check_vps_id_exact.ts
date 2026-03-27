import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function checkVPSIdExact() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  
  const res = await fetch(`${vpsBase}/products/b79c8df4-5bd6-4766-9f3d-2020a6292faa`, {
    headers: { 'X-Sync-Key': syncKey }
  });
  
  const data = await res.json();
  console.log('VPS Exact Product:', JSON.stringify(data, null, 2));
}

checkVPSIdExact();
