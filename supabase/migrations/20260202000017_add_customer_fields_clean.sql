-- Add ONLY customer-relevant custom fields
-- Migration: 20260202_add_customer_fields_clean.sql

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Get company ID
    SELECT id INTO v_company_id FROM companies WHERE slug = 'mercado-do-vale' LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Company not found';
    END IF;
    
    -- 1. Limite de Crédito
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'limite_credito', 'Limite de Crédito', 'basic', 'number', 1, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 2. Dia de Vencimento
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, validation)
    VALUES (v_company_id, 'dia_vencimento', 'Dia de Vencimento', 'basic', 'number', 2, false, '{"min": 1, "max": 31}')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 3. Desconto Especial
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, validation)
    VALUES (v_company_id, 'desconto_especial', 'Desconto Especial (%)', 'price', 'number', 3, false, '{"min": 0, "max": 100}')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 4. Preferência de Contato
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, options)
    VALUES (v_company_id, 'preferencia_contato', 'Preferência de Contato', 'basic', 'select', 4, false, '["Email", "WhatsApp", "Telefone"]')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 5. Prioridade
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, options)
    VALUES (v_company_id, 'prioridade', 'Prioridade', 'basic', 'select', 5, false, '["Alta", "Média", "Baixa"]')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 6. Observações de Entrega
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'observacoes_entrega', 'Observações de Entrega', 'logistics', 'textarea', 6, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    RAISE NOTICE 'Customer custom fields created successfully (6 fields)';
END $$;

-- Verify
SELECT key, field_type, label, category, display_order 
FROM custom_fields 
WHERE key IN (
    'limite_credito', 'dia_vencimento', 'desconto_especial', 
    'preferencia_contato', 'prioridade', 'observacoes_entrega'
)
ORDER BY display_order;
