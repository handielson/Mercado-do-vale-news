-- =====================================================
-- FIX PRODUCTS RLS - PERMITIR ACESSO PÚBLICO AO CATÁLOGO
-- =====================================================
-- Problema: Catálogo não abre completamente em produção
-- Causa: Tabela products provavelmente não tem política RLS permitindo SELECT público
-- Solução: Criar política permitindo leitura pública, manter proteção para escrita
-- Data: 2026-02-07
-- =====================================================

-- 1. Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'products';

-- 2. Remover políticas antigas que podem estar bloqueando acesso público
DROP POLICY IF EXISTS "Public read access to products" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;

-- 3. Criar política permitindo SELECT público (similar ao fix de banners e company_settings)
CREATE POLICY "Public read access to products"
  ON products
  FOR SELECT
  USING (true);  -- Permite leitura pública de todos os produtos

-- 4. Garantir que apenas admins podem modificar produtos
DROP POLICY IF EXISTS "Admin manage products" ON products;

CREATE POLICY "Admin manage products"
  ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.client_type = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.client_type = 'ADMIN'
    )
  );

-- 5. Verificar políticas após aplicação
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- 6. Testar acesso público (executar em uma sessão anônima)
-- SELECT COUNT(*) FROM products;  -- Deve retornar o total de produtos sem erro

COMMENT ON POLICY "Public read access to products" ON products IS 
  'Permite acesso público de leitura ao catálogo de produtos. Criado em 2026-02-07 para resolver problema de catálogo não abrindo em produção.';

COMMENT ON POLICY "Admin manage products" ON products IS 
  'Apenas usuários com client_type = ADMIN podem inserir, atualizar ou deletar produtos.';
