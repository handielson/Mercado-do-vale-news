const https = require('https');
require('dotenv').config({ path: '.env.local' });
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;

function fetchSupa(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
    req.on('error', reject); req.end();
  });
}
function postVps(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname: 'api.xiaomipetrolina.com.br', path, method: 'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Sync-Key': SYNC_KEY }
    }, res => { let o=''; res.on('data',c=>o+=c); res.on('end',()=>resolve({status:res.statusCode,body:o})); });
    req.on('error', reject); req.write(data); req.end();
  });
}
function getVps(path) {
  return new Promise((resolve, reject) => {
    https.get('https://api.xiaomipetrolina.com.br' + path, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  const cats = await fetchSupa('/rest/v1/categories?select=*&order=sort_order.asc');
  console.log('Supabase: ' + cats.length + ' categorias\n');
  const ordered = cats.filter(c=>!c.parent_id).concat(cats.filter(c=>c.parent_id));
  let ok=0, err=0;
  for (const cat of ordered) {
    const slug = cat.slug || cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    const res = await postVps('/categories', { id:cat.id, parent_id:cat.parent_id||null, name:cat.name, slug,
      config:cat.config||{}, warranty_days:cat.warranty_days||90, production_days:cat.production_days||0,
      sort_order:cat.sort_order||0, extended_warranty_enabled:cat.extended_warranty_enabled||false,
      margin_wholesale:cat.margin_wholesale||null, margin_reseller:cat.margin_reseller||null });
    console.log('  ' + (cat.parent_id?'  ↳':'•') + ' ' + cat.name + ' → HTTP ' + res.status);
    if (res.status===200||res.status===201) ok++; else { err++; console.log('    ',res.body); }
  }
  console.log('\n✅ ' + ok + ' ok, ' + err + ' erros');
  const vps = await getVps('/categories');
  console.log('VPS agora: ' + vps.length + ' categorias');
  vps.forEach(c => console.log('  '+(c.parent_id?'↳':'•')+' '+c.name));
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
