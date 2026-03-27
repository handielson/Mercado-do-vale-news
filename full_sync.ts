import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullSync() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  
  const id = 'b79c8df4-5bd6-4766-9f3d-2020a6292faa';
  
  // Fetch from Supabase
  const { data: prod, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error || !prod) {
    console.error('Supabase error:', error);
    return;
  }
  
  console.log('Got from Supabase. Putting to VPS...');
  
  // Transform or just send whole prod object
  const res = await fetch(`${vpsBase}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
    body: JSON.stringify(prod)
  });
  
  if (res.ok) {
    console.log('VPS Sync OK');
    const vpsProd = await res.json();
    console.log(vpsProd);
  } else {
    console.error('VPS Sync Failed:', await res.text());
  }
}

fullSync();
