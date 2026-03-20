import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '');
    const { data: policies } = await supabase.rpc('query_policies', { table_name: 'brands' }); // Not sure if this RPC exists. 
    // Let's query pg_policies
    const { data } = await supabase.from('brands').select('id').limit(1);
    console.log(data);
}
check();
