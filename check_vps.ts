import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function checkVPS() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  
  const res = await fetch(`${vpsBase}/products`, {
    headers: { 'X-Sync-Key': syncKey }
  });
  
  const products = await res.json();
  const prod = products.find((p: any) => p.sku === 'P3DPR10A');
  console.log('VPS Product P3DPR10A:', JSON.stringify(prod, null, 2));
}

checkVPS();
