import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

const sbUrl = process.env.VITE_SUPABASE_URL || '';
const sbKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(sbUrl, sbKey);

(async () => {
    const { data: prods, error } = await supabase.from('products').select('*').eq('sku', 'MM-T112');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log(`Supabase tem ${prods.length} produtos com SKU MM-T112`);
    if(prods.length > 0) {
        console.log('Status no Supabase:', prods[0].status, 'Active:', prods[0].active);
        console.log('Stock Supabase:', prods[0].stock);
    }
    
    // Check all products for this category in Supabase
    const { data: catProds, error: err2 } = await supabase.from('products').select('*').eq('category_id', 'e91042f3-ef46-4bae-a7bc-14aafdd54a82');
    console.log(`Supabase tem ${catProds?.length || 0} produtos na categoria Cuidado Pessoal`);
})();
