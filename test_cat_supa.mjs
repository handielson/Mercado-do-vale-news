import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

const sbUrl = process.env.VITE_SUPABASE_URL || '';
const sbKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(sbUrl, sbKey);

(async () => {
    const { data: cats, error } = await supabase.from('categories').select('*');
    if (error) {
        console.error('Error fetching categories from Supabase:', error);
        return;
    }
    
    console.log(`Total categories in Supabase: ${cats.length}`);
    const cat = cats.find(c => c.id === 'e91042f3-ef46-4bae-a7bc-14aafdd54a82');
    
    if (cat) {
        console.log('FOUND Category in Supabase:', cat);
    } else {
        console.log('Category NOT FOUND in Supabase either?!');
        console.log('Here are some valid category IDs:');
        cats.slice(0, 5).forEach(c => console.log(c.id, c.name));
    }
})();
