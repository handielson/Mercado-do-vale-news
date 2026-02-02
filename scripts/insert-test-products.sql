-- ============================================
-- SQL: Criar Produtos de Teste para Inventário
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Certifique-se de estar com a empresa correta selecionada

-- IMPORTANTE: Substitua os UUIDs abaixo pelos valores corretos do seu banco
-- Para pegar sua company_id e category_id, execute primeiro:
-- SELECT id, company_id FROM users WHERE email = 'seu-email@exemplo.com';
-- SELECT id, name FROM categories LIMIT 5;

-- ============================================
-- PASSO 1: Definir variáveis (AJUSTE AQUI!)
-- ============================================

DO $$
DECLARE
    v_company_id UUID;
    v_category_id UUID;
BEGIN
    -- Pegar a primeira company (ajuste se necessário)
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    -- Pegar ou criar categoria
    SELECT id INTO v_category_id FROM categories WHERE name = 'Eletrônicos' LIMIT 1;
    
    IF v_category_id IS NULL THEN
        INSERT INTO categories (name, slug, config, company_id)
        VALUES (
            'Eletrônicos',
            'eletronicos',
            '{
                "imei1": "optional",
                "imei2": "optional",
                "serial": "optional",
                "color": "optional",
                "storage": "optional",
                "ram": "optional",
                "version": "off",
                "battery_health": "off"
            }'::jsonb,
            v_company_id
        )
        RETURNING id INTO v_category_id;
        
        RAISE NOTICE 'Categoria criada: %', v_category_id;
    END IF;
    
    RAISE NOTICE 'Company ID: %', v_company_id;
    RAISE NOTICE 'Category ID: %', v_category_id;
    
    -- ============================================
    -- PASSO 2: Inserir Produtos de Teste
    -- ============================================
    
    INSERT INTO products (
        name,
        sku,
        brand,
        model,
        category_id,
        price_cost,
        price_retail,
        price_reseller,
        price_wholesale,
        specs,
        eans,
        images,
        status,
        track_inventory,
        stock_quantity
    ) VALUES
    -- Produto 1: iPhone 14 Pro Max (Estoque Alto)
    (
        'iPhone 14 Pro Max 256GB Azul',
        'IPH14PM-256-AZ',
        'Apple',
        'iPhone 14 Pro Max',
        v_category_id,
        450000,  -- R$ 4.500,00
        549900,  -- R$ 5.499,00
        519900,  -- R$ 5.199,00
        499900,  -- R$ 4.999,00
        '{"imei1": "123456789012345", "imei2": "987654321098765", "color": "Azul Pacífico", "storage": "256GB", "ram": "6GB", "display": "6.7\"", "battery": "4323mAh"}'::jsonb,
        ARRAY['7891234567890'],
        ARRAY[]::text[],
        'active',
        true,
        45
    ),
    -- Produto 2: Samsung Galaxy S23 Ultra (Estoque Baixo)
    (
        'Samsung Galaxy S23 Ultra 512GB Preto',
        'SAM-S23U-512-PT',
        'Samsung',
        'Galaxy S23 Ultra',
        v_category_id,
        420000,  -- R$ 4.200,00
        519900,  -- R$ 5.199,00
        489900,  -- R$ 4.899,00
        469900,  -- R$ 4.699,00
        '{"imei1": "234567890123456", "imei2": "876543210987654", "color": "Preto Fantasma", "storage": "512GB", "ram": "12GB", "display": "6.8\"", "battery": "5000mAh"}'::jsonb,
        ARRAY['7891234567891'],
        ARRAY[]::text[],
        'active',
        true,
        8
    ),
    -- Produto 3: iPad Air (Sem Estoque)
    (
        'iPad Air 5ª Geração 64GB Prata',
        'IPAD-AIR5-64-PR',
        'Apple',
        'iPad Air',
        v_category_id,
        320000,  -- R$ 3.200,00
        429900,  -- R$ 4.299,00
        399900,  -- R$ 3.999,00
        379900,  -- R$ 3.799,00
        '{"color": "Prata", "storage": "64GB", "ram": "8GB", "display": "10.9\"", "processor": "M1"}'::jsonb,
        ARRAY['7891234567892'],
        ARRAY[]::text[],
        'active',
        true,
        0
    ),
    -- Produto 4: Xiaomi Redmi Note 12 Pro (Estoque Médio)
    (
        'Xiaomi Redmi Note 12 Pro 128GB Verde',
        'XIA-RN12P-128-VD',
        'Xiaomi',
        'Redmi Note 12 Pro',
        v_category_id,
        120000,  -- R$ 1.200,00
        179900,  -- R$ 1.799,00
        159900,  -- R$ 1.599,00
        149900,  -- R$ 1.499,00
        '{"imei1": "345678901234567", "imei2": "765432109876543", "color": "Verde Floresta", "storage": "128GB", "ram": "8GB", "display": "6.67\"", "battery": "5000mAh", "camera": "108MP"}'::jsonb,
        ARRAY['7891234567893'],
        ARRAY[]::text[],
        'active',
        true,
        25
    ),
    -- Produto 5: Motorola Edge 40 (Estoque Baixo)
    (
        'Motorola Edge 40 256GB Azul',
        'MOT-E40-256-AZ',
        'Motorola',
        'Edge 40',
        v_category_id,
        180000,  -- R$ 1.800,00
        249900,  -- R$ 2.499,00
        229900,  -- R$ 2.299,00
        219900,  -- R$ 2.199,00
        '{"imei1": "456789012345678", "imei2": "654321098765432", "color": "Azul Eclipse", "storage": "256GB", "ram": "8GB", "display": "6.55\"", "battery": "4400mAh"}'::jsonb,
        ARRAY['7891234567894'],
        ARRAY[]::text[],
        'active',
        true,
        3
    ),
    -- Produto 6: Samsung Galaxy Tab S8 (Estoque Médio)
    (
        'Samsung Galaxy Tab S8 128GB Grafite',
        'SAM-TABS8-128-GR',
        'Samsung',
        'Galaxy Tab S8',
        v_category_id,
        280000,  -- R$ 2.800,00
        379900,  -- R$ 3.799,00
        349900,  -- R$ 3.499,00
        329900,  -- R$ 3.299,00
        '{"color": "Grafite", "storage": "128GB", "ram": "8GB", "display": "11\"", "battery": "8000mAh", "processor": "Snapdragon 8 Gen 1"}'::jsonb,
        ARRAY['7891234567895'],
        ARRAY[]::text[],
        'active',
        true,
        15
    ),
    -- Produto 7: iPhone 13 (Estoque Alto)
    (
        'iPhone 13 128GB Rosa',
        'IPH13-128-RS',
        'Apple',
        'iPhone 13',
        v_category_id,
        320000,  -- R$ 3.200,00
        419900,  -- R$ 4.199,00
        389900,  -- R$ 3.899,00
        369900,  -- R$ 3.699,00
        '{"imei1": "567890123456789", "imei2": "543210987654321", "color": "Rosa", "storage": "128GB", "ram": "4GB", "display": "6.1\"", "battery": "3240mAh"}'::jsonb,
        ARRAY['7891234567896'],
        ARRAY[]::text[],
        'active',
        true,
        60
    );
    
    RAISE NOTICE '✅ 7 produtos criados com sucesso!';
    RAISE NOTICE '📊 Distribuição de estoque:';
    RAISE NOTICE '  🟢 Em estoque (>10): 4 produtos';
    RAISE NOTICE '  🟡 Estoque baixo (1-10): 2 produtos';
    RAISE NOTICE '  🔴 Sem estoque (0): 1 produto';
    
END $$;

-- ============================================
-- VERIFICAÇÃO: Listar produtos criados
-- ============================================

SELECT 
    name,
    sku,
    brand,
    stock_quantity,
    CASE 
        WHEN stock_quantity = 0 THEN '🔴 Sem estoque'
        WHEN stock_quantity <= 10 THEN '🟡 Estoque baixo'
        ELSE '🟢 Em estoque'
    END as status_estoque,
    specs->>'imei1' as imei1,
    specs->>'color' as cor,
    price_retail / 100.0 as preco_varejo
FROM products
WHERE sku IN (
    'IPH14PM-256-AZ',
    'SAM-S23U-512-PT',
    'IPAD-AIR5-64-PR',
    'XIA-RN12P-128-VD',
    'MOT-E40-256-AZ',
    'SAM-TABS8-128-GR',
    'IPH13-128-RS'
)
ORDER BY stock_quantity DESC;
