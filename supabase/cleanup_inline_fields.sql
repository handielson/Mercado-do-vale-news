-- ============================================================================
-- LIMPAR: Remover dados inline e manter apenas referências
-- ============================================================================
-- Este SQL remove campos inline duplicados e mantém apenas as referências
-- Execute DEPOIS de atualizar o código do CustomFieldsEditor
-- ============================================================================

-- PASSO 1: Limpar campo "Versão" inline da categoria Celulares
-- ============================================================================
UPDATE categories
SET config = jsonb_set(
    config,
    '{custom_fields}',
    (
        SELECT jsonb_agg(
            CASE 
                -- Se o campo tem field_id, manter apenas id, field_id e requirement
                WHEN elem->>'field_id' IS NOT NULL THEN
                    jsonb_build_object(
                        'id', elem->>'id',
                        'field_id', elem->>'field_id',
                        'requirement', elem->>'requirement'
                    )
                -- Se não tem field_id, manter como está (formato antigo)
                ELSE elem
            END
        )
        FROM jsonb_array_elements(config->'custom_fields') elem
    )
)
WHERE name = 'Celulares'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'custom_fields') elem
      WHERE elem->>'field_id' IS NOT NULL
        AND (elem->>'name' IS NOT NULL OR elem->>'key' IS NOT NULL)
  );

-- PASSO 2: Verificar o resultado
-- ============================================================================
SELECT 
    '=== VERIFICAÇÃO: Campos na Categoria Celulares ===' as info;

SELECT 
    c.name as category_name,
    jsonb_pretty(c.config->'custom_fields') as custom_fields
FROM categories c
WHERE c.name = 'Celulares';

-- ============================================================================
-- INSTRUÇÕES:
-- ============================================================================
-- 1. ✅ Execute este SQL
-- 2. 🔄 Recarregue a página de categorias (Ctrl+F5)
-- 3. ✅ O campo "Versão" deve aparecer corretamente
-- 4. 🧪 Teste criando um novo produto
-- 5. ✅ O campo "Versão" deve aparecer como dropdown com opções
-- 
-- IMPORTANTE: Agora quando você adicionar novos campos da biblioteca,
-- eles serão salvos APENAS com field_id, não com todos os dados inline!
-- ============================================================================
