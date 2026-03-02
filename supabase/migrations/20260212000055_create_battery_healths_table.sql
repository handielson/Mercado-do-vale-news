-- Migration: Create battery_healths table
-- Description: Creates table for Battery Health percentages to populate dropdowns in product entry

-- Create battery_healths table
CREATE TABLE IF NOT EXISTS public.battery_healths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    percentage INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Battery Health options (common smartphone battery health percentages)
INSERT INTO public.battery_healths (name, percentage, display_order) VALUES
    ('100%', 100, 1),
    ('95%', 95, 2),
    ('90%', 90, 3),
    ('85%', 85, 4),
    ('80%', 80, 5),
    ('75%', 75, 6),
    ('70%', 70, 7),
    ('65%', 65, 8),
    ('60%', 60, 9)
ON CONFLICT (name) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.battery_healths IS 'Battery health percentage options for products';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_battery_healths_active ON public.battery_healths(active);
CREATE INDEX IF NOT EXISTS idx_battery_healths_display_order ON public.battery_healths(display_order);

-- Enable RLS (Row Level Security)
ALTER TABLE public.battery_healths ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to battery_healths"
    ON public.battery_healths FOR SELECT
    USING (true);

-- Grant permissions
GRANT SELECT ON public.battery_healths TO anon, authenticated;
GRANT ALL ON public.battery_healths TO service_role;
