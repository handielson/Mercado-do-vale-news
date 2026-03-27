import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVpsUpdate() {
  const vpsBase = 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || '';
  const id = 'b79c8df4-5bd6-4766-9f3d-2020a6292faa'; // P3DPR10A
  
  const { data: prod } = await supabase.from('products').select('*').eq('id', id).single();
  if (!prod) return;

  // 1. Set dummy image and video
  const payload1 = { ...prod, images: ['https://dummy.com/img.png'], video_url: 'https://dummy.com/vid.mp4' };
  let res = await fetch(`${vpsBase}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
    body: JSON.stringify(payload1)
  });
  console.log('Set dummy data OK:', res.ok);

  await new Promise(r => setTimeout(r, 1000));
  
  res = await fetch(`${vpsBase}/products/${id}`, { headers: { 'X-Sync-Key': syncKey }});
  let vpsProd = await res.json();
  console.log('After setting:', { images: vpsProd.images, video_url: vpsProd.video_url });
  
  // 3. Update with empty array and null
  const payload2 = { ...prod, images: [], video_url: null };
  res = await fetch(`${vpsBase}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
    body: JSON.stringify(payload2)
  });
  console.log('Clearing data OK:', res.ok);

  await new Promise(r => setTimeout(r, 1000));

  // 4. Fetch to verify they are cleared
  res = await fetch(`${vpsBase}/products/${id}`, { headers: { 'X-Sync-Key': syncKey }});
  vpsProd = await res.json();
  console.log('After clearing:', { images: vpsProd.images, video_url: vpsProd.video_url });
}

testVpsUpdate();
