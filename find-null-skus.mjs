import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cqbdyxxzmkgeghwkozts.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDczOTYsImV4cCI6MjA4NTQ4MzM5Nn0.fqbVtqM6x-BuHbREQqXXJpX_T5l4z1Exw_4DEgPr3nU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkNullSkus() {
    console.log('Buscando produtos...');
    
    // Busca todos os produtos e filtra no JS pra ter certeza, ou filtra na query
    const { data: nullSkus, error: err1 } = await supabase
        .from('products')
        .select('id, name, sku')
        .is('sku', null);

    const { data: emptySkus, error: err2 } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('sku', '');

    if (err1 || err2) {
        console.error('Erro:', err1 || err2);
        return;
    }

    const problemProducts = [...(nullSkus || []), ...(emptySkus || [])];

    if (problemProducts.length === 0) {
        console.log('Nenhum produto sem SKU ou com SKU vazio encontrado.');
    } else {
        console.log(`Encontrados ${problemProducts.length} produtos problemáticos:`);
        problemProducts.forEach(p => {
            console.log(`ID: ${p.id} | Nome: ${p.name} | SKU: ${p.sku === null ? 'NULO' : 'VAZIO'}`);
        });
    }
}

checkNullSkus();
