import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function run() {
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(process.env.VITE_SUPABASE_URL as string, supabaseKey as string);
    const { data: settings } = await supabase.from('company_settings').select('*').limit(1);
    
    if (!settings || settings.length === 0) { console.error("No company settings found!"); return; }
    
    const company = settings[0];
    const token = company.bling_access_token;
    
    console.log("Testing api.bling.com.br/Api/v3/estoques/saldos");
    const stockRes = await fetch("https://api.bling.com.br/Api/v3/estoques/saldos?limite=1", {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log("Status Api/v3:", stockRes.status);
    
    console.log("Testing api.bling.com.br/v3/estoques/saldos");
    const stockRes2 = await fetch("https://api.bling.com.br/v3/estoques/saldos?limite=1", {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Status v3:", stockRes2.status);
}

run().catch(console.error);
