import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function fixRLS() {
  const sql = `
    CREATE POLICY "Allow public select on custom_fields" 
    ON public.custom_fields 
    FOR SELECT 
    USING (true);
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  console.log('Result:', data, error);
}

fixRLS();
