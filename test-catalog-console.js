// 🧪 TESTE DO CATÁLOGO - Cole este código no Console do navegador (F12)

// Importar Supabase
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

// Suas credenciais
const supabase = createClient(
    'https://cqbdyxxzmkgeghwkozts.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDczOTYsImV4cCI6MjA4NTQ4MzM5Nn0.fqbVtqM6x-BuHbREQqXXJpX_T5l4z1Exw_4DEgPr3nU'
);

console.log('🚀 Iniciando testes do catálogo...\n');

// ============================================================================
// 1. Testar Banners
// ============================================================================
console.log('🎨 Testando banners...');
const { data: banners, error: bannersError } = await supabase
    .from('catalog_banners')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

if (bannersError) {
    console.error('❌ Erro nos banners:', bannersError);
} else {
    console.log(`✅ Banners encontrados: ${banners.length}`);
    console.table(banners);
}

// ============================================================================
// 2. Testar Produtos
// ============================================================================
console.log('\n📱 Testando produtos...');
const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, price_retail, featured, is_new, discount_percentage')
    .limit(10);

if (productsError) {
    console.error('❌ Erro nos produtos:', productsError);
} else {
    console.log(`✅ Produtos encontrados: ${products.length}`);
    console.table(products);
}

// ============================================================================
// 3. Testar Estatísticas
// ============================================================================
console.log('\n📊 Testando função de estatísticas...');
const { data: stats, error: statsError } = await supabase
    .rpc('get_catalog_statistics');

if (statsError) {
    console.error('❌ Erro nas estatísticas:', statsError);
} else {
    console.log('✅ Estatísticas:');
    console.log(stats);
}

// ============================================================================
// 4. Resumo
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📋 RESUMO DOS TESTES');
console.log('='.repeat(60));
console.log(`🎨 Banners: ${banners?.length || 0}`);
console.log(`📱 Produtos: ${products?.length || 0}`);
console.log(`⭐ Featured: ${products?.filter(p => p.featured).length || 0}`);
console.log(`🆕 Novos: ${products?.filter(p => p.is_new).length || 0}`);
console.log(`🏷️  Com desconto: ${products?.filter(p => p.discount_percentage > 0).length || 0}`);
console.log('='.repeat(60));

console.log('\n✅ Testes concluídos!');
