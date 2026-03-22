import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function run() {
    const { data, error } = await supabase.from('shipping_settings').select('*').limit(1);
    console.log('Columns in DB:', data && data.length > 0 ? Object.keys(data[0]) : []);
    console.log('Error:', error);
}
run();
