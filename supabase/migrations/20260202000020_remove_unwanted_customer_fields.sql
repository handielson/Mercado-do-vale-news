-- Delete unwanted customer fields from custom_fields
-- Migration: 20260202_remove_unwanted_customer_fields.sql

DO $$
DECLARE
    v_company_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Get company ID
    SELECT id INTO v_company_id FROM companies WHERE slug = 'mercado-do-vale' LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company not found';
    END IF;
    
    -- Delete unwanted fields
    DELETE FROM custom_fields
    WHERE company_id = v_company_id
    AND key IN (
        'vendedor_responsavel',  -- Vendedor Responsável
        'codigo_antigo',         -- Código Antigo
        'data_cadastro_antigo',  -- Data de Cadastro Antigo
        'tags'                   -- Tags
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % unwanted customer fields', v_deleted_count;
END $$;

-- Verify remaining customer fields
SELECT key, label, field_type, category, display_order 
FROM custom_fields 
WHERE key IN (
    'limite_credito', 
    'dia_vencimento', 
    'desconto_especial', 
    'preferencia_contato', 
    'prioridade', 
    'observacoes_entrega'
)
ORDER BY display_order;

-- Show what was deleted
SELECT 'These fields should be deleted:' as message;
SELECT key, label 
FROM custom_fields 
WHERE key IN (
    'vendedor_responsavel',
    'codigo_antigo',
    'data_cadastro_antigo',
    'tags'
);
