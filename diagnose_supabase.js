import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: settings } = await supabase.from('shipping_settings').select('origin_cep, melhor_envio_enabled, melhor_envio_sandbox, melhor_envio_allowed_services, melhor_envio_token').limit(1);
    console.log("DB SETTINGS:\n", JSON.stringify(settings, null, 2));

    const { data: zones } = await supabase.from('shipping_zones').select('name, type, cep_ranges, fixed_price');
    console.log("ZONES:\n", JSON.stringify(zones, null, 2));
}

check();
