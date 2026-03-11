import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) {
    acc[key.trim()] = val.join('=').trim();
  }
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('custom_fields').select('key, name').limit(5);
  console.log('Test select:', data, error);

  // Allow public access
  const sql = `
    CREATE POLICY "Allow public select on custom_fields" 
    ON public.custom_fields 
    FOR SELECT 
    USING (true);
  `;
  const res = await supabase.rpc('exec_sql', { sql_string: sql });
  console.log('RLS update:', res.error || 'Success');
}

run();
