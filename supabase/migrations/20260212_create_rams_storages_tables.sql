-- Migration: Create rams and storages tables
-- Description: Creates tables for RAM and Storage options to populate dropdowns in product entry

-- Create rams table
CREATE TABLE IF NOT EXISTS public.rams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    value_gb INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storages table
CREATE TABLE IF NOT EXISTS public.storages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    value_gb INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert RAM options (common smartphone RAM sizes)
INSERT INTO public.rams (name, value_gb, display_order) VALUES
    ('2GB', 2, 1),
    ('3GB', 3, 2),
    ('4GB', 4, 3),
    ('6GB', 6, 4),
    ('8GB', 8, 5),
    ('12GB', 12, 6),
    ('16GB', 16, 7),
    ('18GB', 18, 8),
    ('24GB', 24, 9)
ON CONFLICT (name) DO NOTHING;

-- Insert Storage options (common smartphone storage sizes)
INSERT INTO public.storages (name, value_gb, display_order) VALUES
    ('16GB', 16, 1),
    ('32GB', 32, 2),
    ('64GB', 64, 3),
    ('128GB', 128, 4),
    ('256GB', 256, 5),
    ('512GB', 512, 6),
    ('1TB', 1024, 7),
    ('2TB', 2048, 8)
ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.rams IS 'RAM memory options for products';
COMMENT ON TABLE public.storages IS 'Storage capacity options for products';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rams_active ON public.rams(active);
CREATE INDEX IF NOT EXISTS idx_rams_display_order ON public.rams(display_order);
CREATE INDEX IF NOT EXISTS idx_storages_active ON public.storages(active);
CREATE INDEX IF NOT EXISTS idx_storages_display_order ON public.storages(display_order);

-- Enable RLS (Row Level Security)
ALTER TABLE public.rams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storages ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to rams"
    ON public.rams FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to storages"
    ON public.storages FOR SELECT
    USING (true);

-- Grant permissions
GRANT SELECT ON public.rams TO anon, authenticated;
GRANT SELECT ON public.storages TO anon, authenticated;
GRANT ALL ON public.rams TO service_role;
GRANT ALL ON public.storages TO service_role;
