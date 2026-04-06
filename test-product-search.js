// Script de teste para verificar busca de produtos
// Execute no console do navegador (F12)

// 1. Testar conexão com Supabase
console.log('🔍 Testando busca de produtos...');

// 2. Importar supabase
import { supabase } from './services/supabase';

// 3. Buscar todos os produtos ativos
const testSearch = async () => {
    console.log('📊 Buscando todos os produtos ativos...');

    const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    console.log(`✅ Total de produtos ativos: ${count}`);
    console.log('📦 Produtos:', data);

    if (data && data.length > 0) {
        console.log('📝 Exemplo de produto:', data[0]);
        console.log('🏷️ Nome do primeiro produto:', data[0].name);
    } else {
        console.warn('⚠️ Nenhum produto encontrado! Cadastre produtos primeiro.');
    }
};

testSearch();
