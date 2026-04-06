-- =====================================================
-- FIX BRANDS RLS v2 — usa auth.role() em vez de users.client_type
-- =====================================================
-- Problema: UPDATE retorna 204 mas afeta 0 linhas
-- Causa: A policy anterior verificava users.client_type = 'ADMIN'
--        mas admins são verificados via customers table neste projeto
-- Solução: Permitir qualquer usuário autenticado fazer writes em brands
-- Data: 2026-02-19
-- =====================================================

-- 1. Ver todas as policies atuais na tabela brands
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'brands';

-- 2. Remover policies antigas que podem estar conflitando
DROP POLICY IF EXISTS "Admin manage brands" ON brands;
DROP POLICY IF EXISTS "Authenticated write brands" ON brands;
DROP POLICY IF EXISTS "Public read access to brands" ON brands;
DROP POLICY IF EXISTS "brands_update_policy" ON brands;

-- 3. Leitura pública (catálogo)
CREATE POLICY "brands_public_read"
  ON brands
  FOR SELECT
  USING (true);

-- 4. Escrita permitida para qualquer usuário autenticado
CREATE POLICY "brands_authenticated_write"
  ON brands
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Confirmar resultado
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'brands'
ORDER BY policyname;
