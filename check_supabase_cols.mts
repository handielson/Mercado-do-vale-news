import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]).join(', '));
    console.log("Has video_url:", 'video_url' in data[0]);
  } else {
    console.log("No products found to check columns");
  }
}
check();
