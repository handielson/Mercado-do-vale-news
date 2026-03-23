require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function main() {
    const { data } = await supabase.from('products').select('slug, images').ilike('slug', '%pelicula-3d-privativa-para-redmi-note-8%');
    console.log('DATA:', JSON.stringify(data, null, 2));
}
main();
