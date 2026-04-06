-- =========================================================================
-- PROMOTIONS AND BENEFITS SYSTEM
-- Creates tables and RLS policies for managing promotions (like the 1 Year Free Screen Protector)
-- and tracking customer benefits and redemptions.
-- =========================================================================

-- 1. PROMOTIONS TABLE
-- Stores the configuration and status of global promotions.
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE, -- e.g., 'one_year_screen_protector'
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'scheduled')) DEFAULT 'inactive',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by type and status
CREATE INDEX IF NOT EXISTS idx_promotions_type ON public.promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON public.promotions(status);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotions
-- Anyone can view active/scheduled promotions (needed for the public catalog banner)
CREATE POLICY "Public can view promotions"
    ON public.promotions FOR SELECT
    USING (true);

-- Only Admins can insert/update/delete promotions
CREATE POLICY "Admins can insert promotions"
    ON public.promotions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update promotions"
    ON public.promotions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can delete promotions"
    ON public.promotions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

-- 2. CUSTOMER BENEFITS TABLE
-- Tracks which customers have been granted which benefits
CREATE TABLE IF NOT EXISTS public.customer_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    promotion_type TEXT NOT NULL REFERENCES public.promotions(type) ON UPDATE CASCADE,
    source_sale_id UUID, -- Optional: links to the sale that granted this benefit
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ, -- When the benefit expires (e.g., 1 year from granted_at)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_benefits_customer_id ON public.customer_benefits(customer_id);

-- Enable RLS
ALTER TABLE public.customer_benefits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_benefits
-- Customers can view their own benefits, Admins can view all
CREATE POLICY "Customers can view their own benefits"
    ON public.customer_benefits FOR SELECT
    USING (
        auth.uid() = customer_id OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

-- Only Admins can insert/update/delete benefits
CREATE POLICY "Admins can manage customer benefits"
    ON public.customer_benefits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

-- 3. BENEFIT REDEMPTIONS TABLE
-- Tracks monthly or individual usages of a benefit
CREATE TABLE IF NOT EXISTS public.benefit_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_id UUID NOT NULL REFERENCES public.customer_benefits(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL, -- Format: 'YYYY-MM' (Used to limit 1 redemption per month)
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_by UUID NOT NULL REFERENCES public.customers(id), -- The admin/staff who performed the redemption
    notes TEXT,
    
    -- Constraint: Only ONE redemption per benefit per month
    CONSTRAINT uk_benefit_id_year_month UNIQUE (benefit_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_benefit_redemptions_benefit_id ON public.benefit_redemptions(benefit_id);

-- Enable RLS
ALTER TABLE public.benefit_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for benefit_redemptions
-- Customers can view their own redemptions (via join), Admins can view all
CREATE POLICY "Users can view their own benefit redemptions"
    ON public.benefit_redemptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customer_benefits cb
            WHERE cb.id = benefit_id AND cb.customer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

-- Only Admins can insert/update/delete redemptions
CREATE POLICY "Admins can manage benefit redemptions"
    ON public.benefit_redemptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE id = auth.uid() AND customer_type = 'ADMIN'
        )
    );

-- Initial Data Seed (Optional: Creates the base promotion record in 'inactive' state so the admin panel has it)
INSERT INTO public.promotions (type, title, description, status) 
VALUES (
    'one_year_screen_protector', 
    '1 Ano de Película Grátis', 
    'Ao comprar qualquer celular, ganhe 1 película grátis por mês durante 1 ano. Resgate válido apenas na loja física.', 
    'inactive'
) ON CONFLICT (type) DO NOTHING;
