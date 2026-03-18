import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log(process.env.VITE_SUPABASE_URL);
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.from('customers').select('id, admin_preview_type').limit(1);
    console.log("Select Error:", error);
    console.log("Data:", data);
}
run();
