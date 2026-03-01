-- =============================================================
-- Fix: Unify model_id for all "Suporte Carona Universal" variants
-- Goal: Make groupProductsByVariants aggregate them into one card
-- =============================================================

DO $$
DECLARE
    v_target_model_id UUID;
    v_rows_updated INT;
BEGIN
    -- Get the model_id of the first active "Suporte Carona" product that has a model_id
    SELECT model_id INTO v_target_model_id
    FROM products
    WHERE name ILIKE '%suporte carona%'
      AND model_id IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_target_model_id IS NULL THEN
        RAISE NOTICE 'Nenhum modelo encontrado para Suporte Carona. Verifique o nome do produto.';
        RETURN;
    END IF;

    RAISE NOTICE 'Usando model_id: %', v_target_model_id;

    -- Update all Suporte Carona variants to share this same model_id
    UPDATE products
    SET model_id = v_target_model_id
    WHERE name ILIKE '%suporte carona%'
      AND (model_id != v_target_model_id OR model_id IS NULL);

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE NOTICE 'Linhas atualizadas: %', v_rows_updated;
END $$;

-- Verificação: listar os produtos após a correção
SELECT id, name, sku, model_id, specs->>'color' AS color, stock_quantity, status
FROM products
WHERE name ILIKE '%suporte carona%'
ORDER BY name;
