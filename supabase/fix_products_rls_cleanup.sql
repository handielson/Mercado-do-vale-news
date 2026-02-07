-- =====================================================
-- CLEANUP: REMOVER POLÍTICAS RLS CONFLITANTES
-- =====================================================
-- Problema: Duas políticas SELECT conflitantes na tabela products
-- Solução: Manter apenas a política pública, remover a antiga baseada em company_id
-- Data: 2026-02-07
-- =====================================================

-- 1. Remover política antiga que restringe por company_id
-- Esta política está conflitando com o acesso público ao catálogo
DROP POLICY IF EXISTS "Users can view their company products" ON products;

-- 2. Verificar se a política pública está ativa
SELECT policyname, cmd, 
       CASE WHEN qual = 'true' THEN '✅ Acesso Público' ELSE '⚠️ Restrito' END as status
FROM pg_policies
WHERE tablename = 'products' AND cmd = 'SELECT';

-- 3. Resultado esperado: Apenas "Public read access to products" deve aparecer

COMMENT ON POLICY "Public read access to products" ON products IS 
  'Política única de SELECT para produtos. Permite acesso público ao catálogo sem autenticação. Política antiga baseada em company_id foi removida em 2026-02-07.';
