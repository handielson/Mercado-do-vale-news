import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cqbdyxxzmkgeghwkozts.supabase.co'; 
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NzU4MTUsImV4cCI6MjA1NDM1MTgxNX0.YcPZKqJDzVwdXrTKHNz0bqKFiTdYVZKmVOuKWxbQDQo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: prods, error } = await supabase
        .from('products')
        .select(`
            id, name, sku, bling_id, price_retail, stock_quantity, status,
            model_id
        `)
        .eq('sku', 'CSR10AROS');

    if (error) console.error(error);
    console.log(JSON.stringify(prods, null, 2));
}

run();
