import { createClient } from '@supabase/supabase-js';

const url = 'https://cqbdyxxzmkgeghwkozts.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NzU4MTUsImV4cCI6MjA1NDM1MTgxNX0.YcPZKqJDzVwdXrTKHNz0bqKFiTdYVZKmVOuKWxbQDQo';

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, bling_id, price_retail')
      .ilike('name', '%iPhone 12%Pr%');
    console.log(error || JSON.stringify(data, null, 2));
}
run();
