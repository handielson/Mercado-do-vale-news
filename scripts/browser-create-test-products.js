// ============================================
// SCRIPT DE TESTE: Criar Produtos de Inventário
// ============================================
// Cole este código no console do browser (F12)
// enquanto estiver logado na aplicação

async function createTestProducts() {
    console.log('🚀 Iniciando criação de produtos de teste...');

    // Importar supabase do módulo
    const { supabase } = await import('/src/services/supabase.ts');
    const { ProductStatus } = await import('/src/utils/field-standards.ts');

    // Verificar autenticação
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        console.error('❌ Você precisa estar logado!');
        return;
    }

    // Pegar company_id
    const { data: userRecord } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

    if (!userRecord?.company_id) {
        console.error('❌ Company não encontrada');
        return;
    }

    console.log('✅ Usuário autenticado:', userData.user.email);

    // Pegar ou criar categoria
    let categoryId;
    const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .limit(1);

    if (categories && categories.length > 0) {
        categoryId = categories[0].id;
        console.log('📁 Usando categoria:', categories[0].name);
    } else {
        console.log('📁 Criando categoria de teste...');
        const { data: newCategory } = await supabase
            .from('categories')
            .insert({
                name: 'Eletrônicos',
                description: 'Categoria de teste',
                company_id: userRecord.company_id
            })
            .select()
            .single();

        if (!newCategory) {
            console.error('❌ Erro ao criar categoria');
            return;
        }
        categoryId = newCategory.id;
    }

    // Produtos de teste
    const products = [
        {
            name: 'iPhone 14 Pro Max 256GB Azul',
            sku: 'IPH14PM-256-AZ',
            brand: 'Apple',
            model: 'iPhone 14 Pro Max',
            category_id: categoryId,
            price_cost: 450000,
            price_retail: 549900,
            price_reseller: 519900,
            price_wholesale: 499900,
            specs: {
                imei1: '123456789012345',
                imei2: '987654321098765',
                color: 'Azul Pacífico',
                storage: '256GB',
                ram: '6GB'
            },
            eans: ['7891234567890'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 45
        },
        {
            name: 'Samsung Galaxy S23 Ultra 512GB Preto',
            sku: 'SAM-S23U-512-PT',
            brand: 'Samsung',
            model: 'Galaxy S23 Ultra',
            category_id: categoryId,
            price_cost: 420000,
            price_retail: 519900,
            price_reseller: 489900,
            price_wholesale: 469900,
            specs: {
                imei1: '234567890123456',
                imei2: '876543210987654',
                color: 'Preto Fantasma',
                storage: '512GB',
                ram: '12GB'
            },
            eans: ['7891234567891'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 8
        },
        {
            name: 'iPad Air 5ª Geração 64GB Prata',
            sku: 'IPAD-AIR5-64-PR',
            brand: 'Apple',
            model: 'iPad Air',
            category_id: categoryId,
            price_cost: 320000,
            price_retail: 429900,
            price_reseller: 399900,
            price_wholesale: 379900,
            specs: {
                color: 'Prata',
                storage: '64GB',
                ram: '8GB'
            },
            eans: ['7891234567892'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 0
        },
        {
            name: 'Xiaomi Redmi Note 12 Pro 128GB Verde',
            sku: 'XIA-RN12P-128-VD',
            brand: 'Xiaomi',
            model: 'Redmi Note 12 Pro',
            category_id: categoryId,
            price_cost: 120000,
            price_retail: 179900,
            price_reseller: 159900,
            price_wholesale: 149900,
            specs: {
                imei1: '345678901234567',
                imei2: '765432109876543',
                color: 'Verde Floresta',
                storage: '128GB',
                ram: '8GB'
            },
            eans: ['7891234567893'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 25
        },
        {
            name: 'Motorola Edge 40 256GB Azul',
            sku: 'MOT-E40-256-AZ',
            brand: 'Motorola',
            model: 'Edge 40',
            category_id: categoryId,
            price_cost: 180000,
            price_retail: 249900,
            price_reseller: 229900,
            price_wholesale: 219900,
            specs: {
                imei1: '456789012345678',
                imei2: '654321098765432',
                color: 'Azul Eclipse',
                storage: '256GB',
                ram: '8GB'
            },
            eans: ['7891234567894'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 3
        }
    ];

    console.log(`📦 Inserindo ${products.length} produtos...`);

    const { data, error } = await supabase
        .from('products')
        .insert(products)
        .select();

    if (error) {
        console.error('❌ Erro ao criar produtos:', error);
        return;
    }

    console.log(`✅ ${data.length} produtos criados com sucesso!`);
    console.log('📊 Distribuição de estoque:');
    console.log('  🟢 Em estoque (>10): 2 produtos');
    console.log('  🟡 Estoque baixo (1-10): 2 produtos');
    console.log('  🔴 Sem estoque (0): 1 produto');
    console.log('\n🎯 Acesse /admin/inventory para ver!');

    return data;
}

// Executar
createTestProducts();
