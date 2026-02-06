-- Script IDEMPOTENTE para adicionar sistema de drafts ao catálogo
-- Pode ser executado múltiplas vezes sem erros

-- 1. Adicionar campos is_draft e published_at em catalog_banners (se não existirem)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'catalog_banners' AND column_name = 'is_draft'
    ) THEN
        ALTER TABLE catalog_banners ADD COLUMN is_draft BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'catalog_banners' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE catalog_banners ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Criar tabela catalog_settings (se não existir)
CREATE TABLE IF NOT EXISTS catalog_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    is_draft BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices (se não existirem)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_catalog_banners_is_draft'
    ) THEN
        CREATE INDEX idx_catalog_banners_is_draft ON catalog_banners(is_draft);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_catalog_settings_is_draft'
    ) THEN
        CREATE INDEX idx_catalog_settings_is_draft ON catalog_settings(is_draft);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_catalog_settings_key'
    ) THEN
        CREATE INDEX idx_catalog_settings_key ON catalog_settings(setting_key);
    END IF;
END $$;

-- 4. Habilitar RLS em catalog_settings (se não estiver habilitado)
ALTER TABLE catalog_settings ENABLE ROW LEVEL SECURITY;

-- 5. Remover políticas antigas se existirem e recriar
DROP POLICY IF EXISTS "Public can view published catalog settings" ON catalog_settings;
DROP POLICY IF EXISTS "Admins can manage catalog settings" ON catalog_settings;
DROP POLICY IF EXISTS "Public can view published banners" ON catalog_banners;
DROP POLICY IF EXISTS "Admins can view all banners including drafts" ON catalog_banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON catalog_banners;

-- 6. Criar política para público ver apenas configurações publicadas
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

-- 8. Atualizar política de banners para público (apenas publicados)
CREATE POLICY "Public can view published banners"
ON catalog_banners
FOR SELECT
TO public
USING (is_draft = false AND active = true);

-- 9. Criar política para admins verem todos os banners (incluindo drafts)
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

-- 10. Criar política para admins gerenciarem banners
CREATE POLICY "Admins can manage banners"
ON catalog_banners
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.client_type = 'ADMIN'
    )
);

-- 11. Marcar banners existentes como publicados (apenas se ainda não tiverem is_draft definido)
UPDATE catalog_banners 
SET is_draft = false, published_at = NOW()
WHERE is_draft IS NULL OR published_at IS NULL;

-- Verificação final
SELECT 
    'catalog_banners' as table_name,
    COUNT(*) as total_banners,
    COUNT(*) FILTER (WHERE is_draft = false) as published,
    COUNT(*) FILTER (WHERE is_draft = true) as drafts
FROM catalog_banners
UNION ALL
SELECT 
    'catalog_settings' as table_name,
    COUNT(*) as total_settings,
    COUNT(*) FILTER (WHERE is_draft = false) as published,
    COUNT(*) FILTER (WHERE is_draft = true) as drafts
FROM catalog_settings;
