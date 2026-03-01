import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabaseAdmin.from('customer_feedbacks').select('*');
    console.log('Customer Feedbacks:', data);
    console.log('Error:', error);

    const { data: users, error: err2 } = await supabaseAdmin.from('customers').select('id, name, customer_type, company_id').eq('customer_type', 'ADMIN').limit(1);
    console.log('Admin:', users);
}

check();
