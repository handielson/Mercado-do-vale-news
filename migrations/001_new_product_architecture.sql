-- ============================================================================
-- Migration: Nova Arquitetura de Produtos
-- Descrição: Reestruturação completa do sistema de produtos
-- Data: 2026-02-10
-- ============================================================================

-- FASE 1.1: EXPANDIR TABELA MODELS
-- Adiciona colunas de especificações técnicas como campos reais
-- ============================================================================

-- Adicionar colunas de especificações técnicas
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS processor VARCHAR(255),
ADD COLUMN IF NOT EXISTS chipset VARCHAR(255),
ADD COLUMN IF NOT EXISTS battery_mah INTEGER,
ADD COLUMN IF NOT EXISTS display DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS main_camera_mpx VARCHAR(50),
ADD COLUMN IF NOT EXISTS selfie_camera_mpx VARCHAR(50),
ADD COLUMN IF NOT EXISTS nfc VARCHAR(10),
ADD COLUMN IF NOT EXISTS network VARCHAR(10),
ADD COLUMN IF NOT EXISTS resistencia VARCHAR(50),
ADD COLUMN IF NOT EXISTS antutu VARCHAR(50),
ADD COLUMN IF NOT EXISTS custom_specs JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN models.processor IS 'Processador do modelo (ex: Helio G200 Ultra)';
COMMENT ON COLUMN models.chipset IS 'Chipset do modelo (ex: MediaTek)';
COMMENT ON COLUMN models.battery_mah IS 'Capacidade da bateria em mAh';
COMMENT ON COLUMN models.display IS 'Tamanho da tela em polegadas';
COMMENT ON COLUMN models.main_camera_mpx IS 'Câmera principal em megapixels';
COMMENT ON COLUMN models.selfie_camera_mpx IS 'Câmera frontal em megapixels';
COMMENT ON COLUMN models.nfc IS 'Suporte NFC (Sim/Não)';
COMMENT ON COLUMN models.network IS 'Tipo de rede (4G/5G)';
COMMENT ON COLUMN models.resistencia IS 'Resistência à água/poeira (ex: IP68)';
COMMENT ON COLUMN models.antutu IS 'Score Antutu';
COMMENT ON COLUMN models.custom_specs IS 'Especificações customizadas em formato JSONB';

-- ============================================================================
-- FASE 1.2: CRIAR TABELA MODEL_EANS
-- Suporta múltiplos EANs por modelo (variações regionais)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_eans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    ean VARCHAR(13) NOT NULL,
    country_code VARCHAR(3), -- BR, CN, IN, etc.
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_ean UNIQUE(ean),
    CONSTRAINT valid_ean_length CHECK (LENGTH(ean) = 13)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_model_eans_ean ON model_eans(ean);
CREATE INDEX IF NOT EXISTS idx_model_eans_model_id ON model_eans(model_id);
CREATE INDEX IF NOT EXISTS idx_model_eans_primary ON model_eans(model_id, is_primary) WHERE is_primary = true;

-- Comentários
COMMENT ON TABLE model_eans IS 'Códigos EAN associados aos modelos (suporta múltiplos EANs por modelo)';
COMMENT ON COLUMN model_eans.ean IS 'Código EAN-13 (13 dígitos)';
COMMENT ON COLUMN model_eans.country_code IS 'Código do país de origem (ISO 3166-1 alpha-3)';
COMMENT ON COLUMN model_eans.is_primary IS 'Indica se este é o EAN principal do modelo';

-- ============================================================================
-- FASE 1.3: CRIAR TABELA MODEL_VARIANTS
-- Combinação Modelo + Versão + Cor = Variante com galeria de imagens
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES versions(id),
    color_id UUID NOT NULL REFERENCES colors(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único para evitar duplicatas
    CONSTRAINT unique_variant UNIQUE(model_id, version_id, color_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_model_variants_model_id ON model_variants(model_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_version_id ON model_variants(version_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_color_id ON model_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_lookup ON model_variants(model_id, version_id, color_id);

-- Comentários
COMMENT ON TABLE model_variants IS 'Variantes de modelos (Modelo + Versão + Cor)';
COMMENT ON COLUMN model_variants.model_id IS 'Referência ao modelo';
COMMENT ON COLUMN model_variants.version_id IS 'Versão de mercado (Global, Indiana, etc.)';
COMMENT ON COLUMN model_variants.color_id IS 'Cor da variante';

-- ============================================================================
-- FASE 1.4: CRIAR TABELA MODEL_VARIANT_IMAGES
-- Galeria de imagens por variante (5+ fotos por variante)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES model_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_display_order CHECK (display_order >= 0)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON model_variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_order ON model_variant_images(variant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_variant_images_primary ON model_variant_images(variant_id, is_primary) WHERE is_primary = true;

-- Comentários
COMMENT ON TABLE model_variant_images IS 'Galeria de imagens das variantes de modelos';
COMMENT ON COLUMN model_variant_images.image_url IS 'URL da imagem no storage legado';
COMMENT ON COLUMN model_variant_images.display_order IS 'Ordem de exibição (0 = primeira)';
COMMENT ON COLUMN model_variant_images.is_primary IS 'Indica se esta é a imagem principal da variante';

-- ============================================================================
-- FASE 1.5: ATUALIZAR TABELA PRODUCTS
-- Adiciona referências para variante e EAN específico
-- ============================================================================

-- Adicionar novas colunas
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES model_variants(id),
ADD COLUMN IF NOT EXISTS ean VARCHAR(13) REFERENCES model_eans(ean);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_products_variant_id ON products(variant_id);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);

-- Comentários
COMMENT ON COLUMN products.variant_id IS 'Referência à variante do modelo (herda imagens)';
COMMENT ON COLUMN products.ean IS 'EAN específico desta unidade (para rastreabilidade)';

-- ============================================================================
-- TRIGGERS E FUNÇÕES AUXILIARES
-- ============================================================================

-- Trigger para atualizar updated_at em model_variants
CREATE OR REPLACE FUNCTION update_model_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_variants_updated_at
    BEFORE UPDATE ON model_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_model_variants_updated_at();

-- Função para garantir apenas 1 EAN principal por modelo
CREATE OR REPLACE FUNCTION ensure_single_primary_ean()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        -- Remove flag primary de outros EANs do mesmo modelo
        UPDATE model_eans 
        SET is_primary = false 
        WHERE model_id = NEW.model_id 
        AND id != NEW.id 
        AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_ean
    BEFORE INSERT OR UPDATE ON model_eans
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_ean();

-- Função para garantir apenas 1 imagem principal por variante
CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        -- Remove flag primary de outras imagens da mesma variante
        UPDATE model_variant_images 
        SET is_primary = false 
        WHERE variant_id = NEW.variant_id 
        AND id != NEW.id 
        AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_image
    BEFORE INSERT OR UPDATE ON model_variant_images
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_image();

-- ============================================================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE model_eans ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_variant_images ENABLE ROW LEVEL SECURITY;

-- Políticas para model_eans
CREATE POLICY "model_eans_select_policy" ON model_eans
    FOR SELECT USING (true); -- Público pode ver

CREATE POLICY "model_eans_insert_policy" ON model_eans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_eans.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_eans_update_policy" ON model_eans
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_eans.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_eans_delete_policy" ON model_eans
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_eans.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

-- Políticas para model_variants
CREATE POLICY "model_variants_select_policy" ON model_variants
    FOR SELECT USING (true); -- Público pode ver

CREATE POLICY "model_variants_insert_policy" ON model_variants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_variants.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_variants_update_policy" ON model_variants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_variants.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_variants_delete_policy" ON model_variants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM models 
            WHERE models.id = model_variants.model_id 
            AND models.company_id = auth.uid()::uuid
        )
    );

-- Políticas para model_variant_images
CREATE POLICY "model_variant_images_select_policy" ON model_variant_images
    FOR SELECT USING (true); -- Público pode ver

CREATE POLICY "model_variant_images_insert_policy" ON model_variant_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM model_variants mv
            JOIN models m ON m.id = mv.model_id
            WHERE mv.id = model_variant_images.variant_id 
            AND m.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_variant_images_update_policy" ON model_variant_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM model_variants mv
            JOIN models m ON m.id = mv.model_id
            WHERE mv.id = model_variant_images.variant_id 
            AND m.company_id = auth.uid()::uuid
        )
    );

CREATE POLICY "model_variant_images_delete_policy" ON model_variant_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM model_variants mv
            JOIN models m ON m.id = mv.model_id
            WHERE mv.id = model_variant_images.variant_id 
            AND m.company_id = auth.uid()::uuid
        )
    );

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration concluída com sucesso!';
    RAISE NOTICE '📋 Tabelas criadas/atualizadas:';
    RAISE NOTICE '   - models (expandida com especificações)';
    RAISE NOTICE '   - model_eans (nova)';
    RAISE NOTICE '   - model_variants (nova)';
    RAISE NOTICE '   - model_variant_images (nova)';
    RAISE NOTICE '   - products (atualizada)';
    RAISE NOTICE '🔒 RLS habilitado em todas as novas tabelas';
    RAISE NOTICE '⚡ Índices criados para performance';
    RAISE NOTICE '🎯 Triggers configurados para integridade';
END $$;
