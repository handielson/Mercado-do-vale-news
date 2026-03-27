import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function checkVPSName() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  
  const res = await fetch(`${vpsBase}/products`, {
    headers: { 'X-Sync-Key': syncKey }
  });
  
  const products = await res.json();
  const prod = products.filter((p: any) => p.name && p.name.includes('Privativa para Redmi 10A'));
  
  console.log('VPS Products with name:', JSON.stringify(prod, null, 2));
}

checkVPSName();
