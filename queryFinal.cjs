const url = 'https://cqbdyxxzmkgeghwkozts.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NzU4MTUsImV4cCI6MjA1NDM1MTgxNX0.YcPZKqKJDzVwdXrTKHNz0bqKFiTdYVZKmVOuKWxbQDQo';
const company = '9717131e-7b14-4aec-84a4-4317c0489985';

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
    const { data: d1, error } = await supabase.from('products')
        .select('name, model, brand, model_id, specs')
        .eq('company_id', company)
        .ilike('name', '%360%')
        .limit(10);
        
    if (error) { console.error('Error d1:', error); return; }
    console.log('360:', JSON.stringify(d1, null, 2));

    const { data: d2, error: error2 } = await supabase.from('products')
        .select('name, model, brand, model_id, specs')
        .eq('company_id', company)
        .ilike('name', '%Note 60%')
        .limit(10);
    if(error2) console.error('Error d2:', error2);
    console.log('Note 60:', JSON.stringify(d2, null, 2));
})();
