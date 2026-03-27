const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const DB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; 
const DB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(DB_URL, DB_KEY);

async function checkSupa() {
    const { data: supaData, error } = await supabase
        .from('company_settings')
        .select('id, shopee_access_token');
    console.log(supaData);
}

checkSupa();
