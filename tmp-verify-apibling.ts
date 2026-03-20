import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function check() {
    console.log("Starting...");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseKey || '');
    
    console.log("Fetching settings...");
    const { data: settings } = await supabase.from('company_settings').select('id, bling_refresh_token, bling_access_token, bling_client_id, bling_client_secret').limit(1).single();
    
    let token = settings.bling_access_token;
    
    console.log("Searching for Cinebox Supremo Pro on api.bling.com.br...");
    const searchUrl = 'https://api.bling.com.br/Api/v3/produtos?nome=Cinebox Supremo Pro';
    const pRes = await fetch(searchUrl, {
        headers: { 'Authorization': Bearer  }
    });
    const pJson = await pRes.json();

    if (pJson.data && pJson.data.length > 0) {
        const id = pJson.data[0].id;
        console.log("Fetching detail for ID: " + id + " on api.bling.com.br...");
        const ref = await fetch(https://api.bling.com.br/Api/v3/produtos/, {
            headers: { 'Authorization': Bearer  }
        });
        const status = ref.status;
        console.log("STATUS: ", status);
    }
}

check().catch(console.error);
