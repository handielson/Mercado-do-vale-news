import { supabase } from './services/supabase';

async function check() {
    const { data, error } = await supabase.from('company_settings').select('address').single();
    if (error) console.error(error);
    console.log("ADDRESS IS:", data?.address);
}

check();
