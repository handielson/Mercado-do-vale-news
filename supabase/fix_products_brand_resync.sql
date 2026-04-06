-- =====================================================
-- FIX PRODUCTS RLS + RESYNC BRAND NAMES
-- =====================================================
-- Problema 1: Cascade de marca não atualiza products (RLS bloqueia UPDATE)
-- Problema 2: Produtos existentes têm nome de marca desatualizado
-- Data: 2026-02-19
-- =====================================================

-- 1. Adicionar policy de escrita para products (mesmo fix feito para brands)
DROP POLICY IF EXISTS "products_authenticated_write" ON products;

CREATE POLICY "products_authenticated_write"
  ON products
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Ver quais products.brand NÃO batem com nenhum brands.name
SELECT DISTINCT p.brand as brand_no_produto, b.name as brand_na_tabela
FROM products p
LEFT JOIN brands b ON p.brand = b.name
WHERE b.name IS NULL
ORDER BY p.brand;

-- 3. Ressincronizar TODOS os produtos com o nome correto da marca
-- (faz match pelo slug para encontrar a marca certa mesmo que o nome tenha mudado)
UPDATE products p
SET brand = b.name
FROM brands b
WHERE LOWER(REGEXP_REPLACE(p.brand, '[^a-z0-9]', '-', 'g')) = b.slug
  AND p.brand != b.name;

-- 4. Confirmar: ver produtos que ainda têm brand sem match
SELECT DISTINCT p.brand, COUNT(*) as qtd
FROM products p
LEFT JOIN brands b ON p.brand = b.name
WHERE b.name IS NULL
GROUP BY p.brand;
