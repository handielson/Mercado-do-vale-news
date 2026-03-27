import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function checkVPSId() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  
  const res = await fetch(`${vpsBase}/products?id=b79c8df4-5bd6-4766-9f3d-2020a6292faa`, {
    headers: { 'X-Sync-Key': syncKey }
  });
  
  const text = await res.text();
  console.log(text);
}

checkVPSId();
