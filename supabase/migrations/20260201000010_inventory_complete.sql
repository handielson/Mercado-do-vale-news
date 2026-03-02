-- ============================================
-- MIGRATION COMPLETA: Página de Inventário
-- ============================================
-- Execute este script completo no Supabase SQL Editor
-- Inclui: tabela stock_movements + produtos de teste

-- ============================================
-- PARTE 1: Criar tabela stock_movements
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Movement Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
    new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
    
    -- Metadata
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('purchase', 'sale', 'loss', 'donation', 'return', 'inventory', 'transfer')),
    notes TEXT,
    reference_id UUID, -- ID da venda/compra relacionada (nullable)
    
    -- Audit Trail
    created_by UUID,  -- User ID who created the movement
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_movement CHECK (
        (type = 'in' AND new_quantity = previous_quantity + quantity) OR
        (type = 'out' AND new_quantity = previous_quantity - quantity) OR
        (type = 'adjustment')
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);

-- Add RLS (Row Level Security) policies
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS stock_movements_select_policy ON stock_movements;
DROP POLICY IF EXISTS stock_movements_insert_policy ON stock_movements;

-- Policy: Authenticated users can see all movements (simplified)
CREATE POLICY stock_movements_select_policy ON stock_movements
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can insert movements (simplified)
CREATE POLICY stock_movements_insert_policy ON stock_movements
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add comments
COMMENT ON TABLE stock_movements IS 'Tracks all stock movements for audit and inventory control';
COMMENT ON COLUMN stock_movements.type IS 'Type of movement: in (entrada), out (saída), adjustment (ajuste)';
COMMENT ON COLUMN stock_movements.reason IS 'Reason for movement: purchase, sale, loss, donation, return, inventory, transfer';
COMMENT ON COLUMN stock_movements.reference_id IS 'Optional reference to related transaction (sale, purchase order, etc)';

-- ============================================
-- PARTE 2: Criar produtos de teste
-- ============================================

DO $$
DECLARE
    v_company_id UUID;
    v_category_id UUID;
BEGIN
    -- Pegar a primeira company
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma company encontrada! Crie uma company primeiro.';
    END IF;
    
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
        
        RAISE NOTICE '✅ Categoria criada: %', v_category_id;
    ELSE
        RAISE NOTICE '✅ Usando categoria existente: %', v_category_id;
    END IF;
    
    RAISE NOTICE 'Company ID: %', v_company_id;
    RAISE NOTICE 'Category ID: %', v_category_id;
    
    -- Inserir produtos de teste
    -- NOTA: Usando apenas campos essenciais que existem em todas as versões
    INSERT INTO products (
        company_id,
        name,
        sku,
        category_id,
        price_cost,
        price_retail,
        price_reseller,
        price_wholesale,
        specs
    ) VALUES
    -- Produto 1: iPhone 14 Pro Max
    (
        v_company_id,
        'iPhone 14 Pro Max 256GB Azul',
        'IPH14PM-256-AZ',
        v_category_id,
        450000,
        549900,
        519900,
        499900,
        '{"brand": "Apple", "model": "iPhone 14 Pro Max", "imei1": "123456789012345", "imei2": "987654321098765", "color": "Azul Pacífico", "storage": "256GB", "ram": "6GB", "stock_quantity": 45}'::jsonb
    ),
    -- Produto 2: Samsung Galaxy S23 Ultra
    (
        v_company_id,
        'Samsung Galaxy S23 Ultra 512GB Preto',
        'SAM-S23U-512-PT',
        v_category_id,
        420000,
        519900,
        489900,
        469900,
        '{"brand": "Samsung", "model": "Galaxy S23 Ultra", "imei1": "234567890123456", "imei2": "876543210987654", "color": "Preto Fantasma", "storage": "512GB", "ram": "12GB", "stock_quantity": 8}'::jsonb
    ),
    -- Produto 3: iPad Air
    (
        v_company_id,
        'iPad Air 5ª Geração 64GB Prata',
        'IPAD-AIR5-64-PR',
        v_category_id,
        320000,
        429900,
        399900,
        379900,
        '{"brand": "Apple", "model": "iPad Air", "color": "Prata", "storage": "64GB", "ram": "8GB", "stock_quantity": 0}'::jsonb
    ),
    -- Produto 4: Xiaomi Redmi Note 12 Pro
    (
        v_company_id,
        'Xiaomi Redmi Note 12 Pro 128GB Verde',
        'XIA-RN12P-128-VD',
        v_category_id,
        120000,
        179900,
        159900,
        149900,
        '{"brand": "Xiaomi", "model": "Redmi Note 12 Pro", "imei1": "345678901234567", "imei2": "765432109876543", "color": "Verde Floresta", "storage": "128GB", "ram": "8GB", "stock_quantity": 25}'::jsonb
    ),
    -- Produto 5: Motorola Edge 40
    (
        v_company_id,
        'Motorola Edge 40 256GB Azul',
        'MOT-E40-256-AZ',
        v_category_id,
        180000,
        249900,
        229900,
        219900,
        '{"brand": "Motorola", "model": "Edge 40", "imei1": "456789012345678", "imei2": "654321098765432", "color": "Azul Eclipse", "storage": "256GB", "ram": "8GB", "stock_quantity": 3}'::jsonb
    ),
    -- Produto 6: Samsung Galaxy Tab S8
    (
        v_company_id,
        'Samsung Galaxy Tab S8 128GB Grafite',
        'SAM-TABS8-128-GR',
        v_category_id,
        280000,
        379900,
        349900,
        329900,
        '{"brand": "Samsung", "model": "Galaxy Tab S8", "color": "Grafite", "storage": "128GB", "ram": "8GB", "stock_quantity": 15}'::jsonb
    ),
    -- Produto 7: iPhone 13
    (
        v_company_id,
        'iPhone 13 128GB Rosa',
        'IPH13-128-RS',
        v_category_id,
        320000,
        419900,
        389900,
        369900,
        '{"brand": "Apple", "model": "iPhone 13", "imei1": "567890123456789", "imei2": "543210987654321", "color": "Rosa", "storage": "128GB", "ram": "4GB", "stock_quantity": 60}'::jsonb
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
    specs->>'brand' as brand,
    CAST(specs->>'stock_quantity' AS INTEGER) as stock_quantity,
    CASE 
        WHEN CAST(COALESCE(specs->>'stock_quantity', '0') AS INTEGER) = 0 THEN '🔴 Sem estoque'
        WHEN CAST(COALESCE(specs->>'stock_quantity', '0') AS INTEGER) <= 10 THEN '🟡 Estoque baixo'
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
ORDER BY CAST(COALESCE(specs->>'stock_quantity', '0') AS INTEGER) DESC;
