import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVpsImageCache() {
  const { data: prods } = await supabase.from('products').select('*');
  const withImages = prods.filter(p => p.images && p.images.length > 0);
  console.log('Sample images:', withImages[0]?.images);
}

testVpsImageCache();
