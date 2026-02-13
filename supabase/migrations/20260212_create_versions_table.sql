-- Create versions table in Supabase
-- Similar pattern to rams and storages tables

CREATE TABLE IF NOT EXISTS public.versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES companies(slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, slug)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_versions_company_id ON public.versions(company_id);
CREATE INDEX IF NOT EXISTS idx_versions_active ON public.versions(active);

-- Enable RLS
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view versions from their company"
    ON public.versions FOR SELECT
    USING (true);

CREATE POLICY "Users can insert versions for their company"
    ON public.versions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update versions from their company"
    ON public.versions FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete versions from their company"
    ON public.versions FOR DELETE
    USING (true);

-- Insert default versions
INSERT INTO public.versions (company_id, name, slug) VALUES
    ('mercado-do-vale', 'Global', 'global'),
    ('mercado-do-vale', 'China', 'china'),
    ('mercado-do-vale', 'USA', 'usa'),
    ('mercado-do-vale', 'Europa', 'europa'),
    ('mercado-do-vale', 'Brasil', 'brasil')
ON CONFLICT (company_id, slug) DO NOTHING;
