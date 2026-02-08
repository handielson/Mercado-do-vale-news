-- =====================================================
-- COLORS TABLE - Supabase Migration
-- =====================================================
-- Multi-tenant color management with RLS
-- Pattern: Same as brands and categories tables
-- =====================================================

-- Create colors table
CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    hex_code TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one color name per company
    CONSTRAINT unique_color_per_company UNIQUE(company_id, slug)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view colors from their company
CREATE POLICY "Users can view colors from their company"
    ON colors FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert colors for their company
CREATE POLICY "Users can insert colors for their company"
    ON colors FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update colors from their company
CREATE POLICY "Users can update colors from their company"
    ON colors FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete colors from their company
CREATE POLICY "Users can delete colors from their company"
    ON colors FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- =====================================================
-- INDEXES
-- =====================================================

-- Index for company_id lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_colors_company_id ON colors(company_id);

-- Index for active colors (used by listActive())
CREATE INDEX IF NOT EXISTS idx_colors_active ON colors(active) WHERE active = true;

-- Index for name ordering
CREATE INDEX IF NOT EXISTS idx_colors_name ON colors(company_id, name);

-- =====================================================
-- SEED DATA (Default Colors)
-- =====================================================

-- Insert default colors for 'mercado-do-vale' company
-- Only if no colors exist yet
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Get company ID
    SELECT id INTO v_company_id 
    FROM companies 
    WHERE slug = 'mercado-do-vale';
    
    -- Insert default colors if company exists and has no colors
    IF v_company_id IS NOT NULL THEN
        INSERT INTO colors (company_id, name, slug, hex_code, active)
        SELECT v_company_id, name, slug, hex_code, true
        FROM (VALUES
            ('Preto', 'preto', '#000000'),
            ('Branco', 'branco', '#FFFFFF'),
            ('Azul', 'azul', '#3B82F6'),
            ('Verde', 'verde', '#10B981'),
            ('Vermelho', 'vermelho', '#EF4444'),
            ('Rosa', 'rosa', '#EC4899'),
            ('Dourado', 'dourado', '#F59E0B'),
            ('Prata', 'prata', '#9CA3AF'),
            ('Cinza', 'cinza', '#6B7280'),
            ('Roxo', 'roxo', '#8B5CF6'),
            ('Amarelo', 'amarelo', '#EAB308'),
            ('Laranja', 'laranja', '#F97316')
        ) AS default_colors(name, slug, hex_code)
        WHERE NOT EXISTS (
            SELECT 1 FROM colors WHERE company_id = v_company_id
        );
    END IF;
END $$;

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_colors_updated_at
    BEFORE UPDATE ON colors
    FOR EACH ROW
    EXECUTE FUNCTION update_colors_updated_at();
