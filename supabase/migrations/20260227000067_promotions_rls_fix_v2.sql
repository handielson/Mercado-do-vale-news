-- =========================================================================
-- FIX DEFINITIVO: RLS de Promoções
-- Problema: customers.id != auth.uid()
-- A tabela customers tem dois campos:
--   - id       → UUID próprio da tabela (PK)
--   - user_id  → UUID do auth.users (= auth.uid())
-- O fix anterior usava customers.id = auth.uid() (ERRADO).
-- Este fix usa customers.user_id = auth.uid() (CORRETO).
-- =========================================================================

-- Promoções
DROP POLICY IF EXISTS "Admins can insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can delete promotions" ON public.promotions;

CREATE POLICY "Admins can insert promotions"
    ON public.promotions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update promotions"
    ON public.promotions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can delete promotions"
    ON public.promotions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

-- Customer Benefits
DROP POLICY IF EXISTS "Customers can view their own benefits" ON public.customer_benefits;
DROP POLICY IF EXISTS "Admins can manage customer benefits" ON public.customer_benefits;

CREATE POLICY "Customers can view their own benefits"
    ON public.customer_benefits FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.id = customer_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage customer benefits"
    ON public.customer_benefits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

-- Benefit Redemptions
DROP POLICY IF EXISTS "Users can view their own benefit redemptions" ON public.benefit_redemptions;
DROP POLICY IF EXISTS "Admins can manage benefit redemptions" ON public.benefit_redemptions;

CREATE POLICY "Users can view their own benefit redemptions"
    ON public.benefit_redemptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customer_benefits cb
            JOIN public.customers c ON c.id = cb.customer_id
            WHERE cb.id = benefit_id AND c.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage benefit redemptions"
    ON public.benefit_redemptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );
