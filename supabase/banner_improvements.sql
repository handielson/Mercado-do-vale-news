-- =====================================================
-- Banner System Improvements
-- Versão: 2.0 | Data: 2026-02-19
-- =====================================================
-- O que faz:
--   1. Adiciona coluna target_audience (segmentação por tipo de cliente)
--   2. Adiciona coluna subtitle (já existe no tipo TS mas não na tabela)
--   3. Corrige RLS: anon pode ver banners ativos (necessário para catálogo público)
-- =====================================================

-- 1. Adicionar campos novos
ALTER TABLE catalog_banners
    ADD COLUMN IF NOT EXISTS target_audience TEXT[] DEFAULT '{}';

ALTER TABLE catalog_banners
    ADD COLUMN IF NOT EXISTS subtitle TEXT;

COMMENT ON COLUMN catalog_banners.target_audience IS
    'Tipos de cliente que podem ver este banner. Array vazio = todos. Valores: varejo, revenda, atacado';

-- 2. Corrigir RLS de SELECT
--    Problema original: SELECT exigia auth.role() = authenticated
--    Isso bloqueava o BannerCarousel no catálogo público (anon)

DROP POLICY IF EXISTS "Authenticated users can view all banners" ON catalog_banners;
DROP POLICY IF EXISTS "Public can view active banners"           ON catalog_banners;
DROP POLICY IF EXISTS "Anon can view active banners"             ON catalog_banners;
DROP POLICY IF EXISTS "Admin can view all banners"               ON catalog_banners;

-- Anônimos: só banners ativos
CREATE POLICY "Public can view active banners"
ON catalog_banners FOR SELECT
TO anon
USING (is_active = true);

-- Autenticados (admin/equipe): todos os banners
CREATE POLICY "Admin can view all banners"
ON catalog_banners FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- Verificação
-- =====================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'catalog_banners'
ORDER BY ordinal_position;
