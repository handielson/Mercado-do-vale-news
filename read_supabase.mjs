import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqbdyxxzmkgeghwkozts.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'N/A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('company_settings')
        .select('id, shopee_partner_id, shopee_partner_key');
        
    console.log(JSON.stringify(data, null, 2));
}

main();
