-- ============================================
-- Script para adicionar sistema de drafts ao catálogo
-- ============================================

-- 1. Adicionar campos de draft aos banners
ALTER TABLE catalog_banners 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

-- 2. Criar índice para melhorar performance de queries de draft
CREATE INDEX IF NOT EXISTS idx_catalog_banners_draft 
ON catalog_banners(is_draft, is_active);

-- 3. Criar tabela de configurações do catálogo
CREATE TABLE IF NOT EXISTS catalog_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layout_config JSONB DEFAULT '{
        "banners_per_page": 5,
        "products_per_row": 4,
        "show_filters": true,
        "carousel_autoplay": true,
        "carousel_interval": 5000
    }'::jsonb,
    is_draft BOOLEAN DEFAULT false,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Inserir configuração padrão (se não existir)
INSERT INTO catalog_settings (layout_config, is_draft, published_at)
VALUES (
    '{
        "banners_per_page": 5,
        "products_per_row": 4,
        "show_filters": true,
        "carousel_autoplay": true,
        "carousel_interval": 5000
    }'::jsonb,
    false,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 5. Habilitar RLS na tabela catalog_settings
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;

-- 6. Criar política para leitura pública (apenas versão publicada)
CREATE POLICY "Public can view published catalog settings"
ON catalog_settings
FOR SELECT
TO public
USING (is_draft = false);

-- 7. Criar política para admins gerenciarem drafts
CREATE POLICY "Admins can manage catalog settings"
ON catalog_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.client_type = 'ADMIN'
    )
);

-- 8. Atualizar política de banners para incluir drafts (apenas admins veem drafts)
DROP POLICY IF EXISTS "Public can view active banners" ON catalog_banners;

CREATE POLICY "Public can view published banners"
ON catalog_banners
FOR SELECT
TO public
USING (is_active = true AND is_draft = false);

CREATE POLICY "Admins can view all banners including drafts"
ON catalog_banners
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.client_type = 'ADMIN'
    )
);

-- ============================================
-- Verificação
-- ============================================

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'catalog_banners'
AND column_name IN ('is_draft', 'published_at');

-- Verificar se a tabela catalog_settings foi criada
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'catalog_settings';

-- Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('catalog_banners', 'catalog_settings')
ORDER BY tablename, policyname;
