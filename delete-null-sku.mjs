import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cqbdyxxzmkgeghwkozts.supabase.co';
// Need service role key to bypass RLS for deletion, or anon key if RLS allows it.
// Let's check if anon key can delete. If not, I'll use service role key.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteProduct() {
    const id = 'cbfe1ae9-484c-4658-8184-c5fcdfee3843';
    console.log(`Deletando produto ID: ${id}`);
    
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao deletar:', error);
    } else {
        console.log('Produto deletado com sucesso do Supabase!');
    }
}

deleteProduct();
