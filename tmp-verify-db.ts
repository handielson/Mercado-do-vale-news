import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function check() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseKey || '');
    
    const { data: b } = await supabase.from('brands').select('name');
    console.log("BRANDS:", b);
    
    // Also check the model Cinebox Supremo Pró
    const { data: m } = await supabase.from('models').select('id, name, brand_id, brands(name)').ilike('name', '%Cinebox%');
    console.log("MODELS:", m);
}

check().catch(console.error);
