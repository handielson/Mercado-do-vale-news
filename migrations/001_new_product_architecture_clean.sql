-- Migration: Nova Arquitetura de Produtos
-- Data: 2026-02-10

-- Expandir tabela models com especificações
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

-- Criar tabela model_eans
CREATE TABLE IF NOT EXISTS model_eans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    ean VARCHAR(13) NOT NULL,
    country_code VARCHAR(3),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_ean UNIQUE(ean),
    CONSTRAINT valid_ean_length CHECK (LENGTH(ean) = 13)
);

CREATE INDEX IF NOT EXISTS idx_model_eans_ean ON model_eans(ean);
CREATE INDEX IF NOT EXISTS idx_model_eans_model_id ON model_eans(model_id);
CREATE INDEX IF NOT EXISTS idx_model_eans_primary ON model_eans(model_id, is_primary) WHERE is_primary = true;

-- Criar tabela versions (se não existir)
CREATE TABLE IF NOT EXISTS versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_versions_company_id ON versions(company_id);

-- Inserir versões padrão se não existirem
INSERT INTO versions (company_id, name)
SELECT DISTINCT company_id, 'Global'
FROM models
WHERE NOT EXISTS (SELECT 1 FROM versions WHERE name = 'Global' AND versions.company_id = models.company_id)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO versions (company_id, name)
SELECT DISTINCT company_id, 'Indiana'
FROM models
WHERE NOT EXISTS (SELECT 1 FROM versions WHERE name = 'Indiana' AND versions.company_id = models.company_id)
ON CONFLICT (company_id, name) DO NOTHING;

-- Criar tabela model_variants
CREATE TABLE IF NOT EXISTS model_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES versions(id),
    color_id UUID NOT NULL REFERENCES colors(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_variant UNIQUE(model_id, version_id, color_id)
);

CREATE INDEX IF NOT EXISTS idx_model_variants_model_id ON model_variants(model_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_version_id ON model_variants(version_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_color_id ON model_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_lookup ON model_variants(model_id, version_id, color_id);

-- Criar tabela model_variant_images
CREATE TABLE IF NOT EXISTS model_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES model_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_display_order CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON model_variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_order ON model_variant_images(variant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_variant_images_primary ON model_variant_images(variant_id, is_primary) WHERE is_primary = true;

-- Atualizar tabela products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES model_variants(id),
ADD COLUMN IF NOT EXISTS ean VARCHAR(13) REFERENCES model_eans(ean);

CREATE INDEX IF NOT EXISTS idx_products_variant_id ON products(variant_id);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);

-- Triggers
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

CREATE OR REPLACE FUNCTION ensure_single_primary_ean()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
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

CREATE OR REPLACE FUNCTION ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
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

-- RLS
ALTER TABLE model_eans ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_variant_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_eans_select_policy" ON model_eans FOR SELECT USING (true);
CREATE POLICY "model_eans_insert_policy" ON model_eans FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_eans.model_id AND models.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_eans_update_policy" ON model_eans FOR UPDATE USING (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_eans.model_id AND models.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_eans_delete_policy" ON model_eans FOR DELETE USING (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_eans.model_id AND models.company_id = auth.uid()::uuid)
);

CREATE POLICY "model_variants_select_policy" ON model_variants FOR SELECT USING (true);
CREATE POLICY "model_variants_insert_policy" ON model_variants FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_variants.model_id AND models.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_variants_update_policy" ON model_variants FOR UPDATE USING (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_variants.model_id AND models.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_variants_delete_policy" ON model_variants FOR DELETE USING (
    EXISTS (SELECT 1 FROM models WHERE models.id = model_variants.model_id AND models.company_id = auth.uid()::uuid)
);

CREATE POLICY "model_variant_images_select_policy" ON model_variant_images FOR SELECT USING (true);
CREATE POLICY "model_variant_images_insert_policy" ON model_variant_images FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM model_variants mv JOIN models m ON m.id = mv.model_id WHERE mv.id = model_variant_images.variant_id AND m.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_variant_images_update_policy" ON model_variant_images FOR UPDATE USING (
    EXISTS (SELECT 1 FROM model_variants mv JOIN models m ON m.id = mv.model_id WHERE mv.id = model_variant_images.variant_id AND m.company_id = auth.uid()::uuid)
);
CREATE POLICY "model_variant_images_delete_policy" ON model_variant_images FOR DELETE USING (
    EXISTS (SELECT 1 FROM model_variants mv JOIN models m ON m.id = mv.model_id WHERE mv.id = model_variant_images.variant_id AND m.company_id = auth.uid()::uuid)
);
