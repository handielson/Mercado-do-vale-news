-- Add customer custom fields to the library
-- Migration: 20260202_add_customer_custom_fields.sql
-- CORRECTED VERSION - Uses correct column names

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
    
    -- 3. Vendedor Responsável
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'vendedor_responsavel', 'Vendedor Responsável', 'basic', 'text', 3, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 4. Desconto Especial
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, validation)
    VALUES (v_company_id, 'desconto_especial', 'Desconto Especial (%)', 'price', 'number', 4, false, '{"min": 0, "max": 100}')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 5. Preferência de Contato
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, options)
    VALUES (v_company_id, 'preferencia_contato', 'Preferência de Contato', 'basic', 'select', 5, false, '["Email", "WhatsApp", "Telefone"]')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 6. Prioridade
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system, options)
    VALUES (v_company_id, 'prioridade', 'Prioridade', 'basic', 'select', 6, false, '["Alta", "Média", "Baixa"]')
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 7. Código Antigo
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'codigo_antigo', 'Código Antigo', 'basic', 'text', 7, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 8. Observações de Entrega
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'observacoes_entrega', 'Observações de Entrega', 'logistics', 'textarea', 8, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 9. Data de Cadastro Antigo
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'data_cadastro_antigo', 'Data de Cadastro Antigo', 'basic', 'text', 9, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    -- 10. Tags
    INSERT INTO custom_fields (company_id, key, label, category, field_type, display_order, is_system)
    VALUES (v_company_id, 'tags', 'Tags', 'basic', 'text', 10, false)
    ON CONFLICT (company_id, key) DO NOTHING;
    
    RAISE NOTICE 'Customer custom fields created successfully';
END $$;

-- Verify
SELECT key, field_type, label, category, display_order 
FROM custom_fields 
WHERE key IN (
    'limite_credito', 'dia_vencimento', 'vendedor_responsavel', 
    'desconto_especial', 'preferencia_contato', 'prioridade',
    'codigo_antigo', 'observacoes_entrega', 'data_cadastro_antigo', 'tags'
)
ORDER BY display_order;
