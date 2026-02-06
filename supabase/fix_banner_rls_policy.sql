-- =====================================================
-- FIX: Política RLS para catalog_banners
-- =====================================================
-- Problema: A política atual usa USING para ALL operations
-- mas INSERT requer WITH CHECK clause
-- =====================================================

-- 1. Remover política incorreta
DROP POLICY IF EXISTS "Authenticated users can manage banners" ON catalog_banners;

-- 2. Criar políticas corretas separadas por operação

-- Política para SELECT (visualizar banners)
CREATE POLICY "Authenticated users can view all banners"
ON catalog_banners FOR SELECT
USING (auth.role() = 'authenticated');

-- Política para INSERT (criar banners)
CREATE POLICY "Authenticated users can insert banners"
ON catalog_banners FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Política para UPDATE (editar banners)
CREATE POLICY "Authenticated users can update banners"
ON catalog_banners FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Política para DELETE (deletar banners)
CREATE POLICY "Authenticated users can delete banners"
ON catalog_banners FOR DELETE
USING (auth.role() = 'authenticated');

-- =====================================================
-- PRONTO! Agora os banners devem ser salvos corretamente
-- =====================================================
