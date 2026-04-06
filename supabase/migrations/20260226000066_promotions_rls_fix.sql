-- Corrige ambiguidade da coluna 'id' nas políticas RLS do módulo de promoções.
-- Antes: WHERE id = auth.uid()  (resolvia para promotions.id)
-- Depois: WHERE customers.id = auth.uid()

DROP POLICY IF EXISTS "Admins can insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can delete promotions" ON public.promotions;

CREATE POLICY "Admins can insert promotions"
    ON public.promotions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update promotions"
    ON public.promotions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can delete promotions"
    ON public.promotions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

-- Corrige admin policies para benefits e redemptions tb
DROP POLICY IF EXISTS "Customers can view their own benefits" ON public.customer_benefits;
DROP POLICY IF EXISTS "Admins can manage customer benefits" ON public.customer_benefits;

CREATE POLICY "Customers can view their own benefits"
    ON public.customer_benefits FOR SELECT
    USING (
        auth.uid() = customer_id OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage customer benefits"
    ON public.customer_benefits FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "Users can view their own benefit redemptions" ON public.benefit_redemptions;
DROP POLICY IF EXISTS "Admins can manage benefit redemptions" ON public.benefit_redemptions;

CREATE POLICY "Users can view their own benefit redemptions"
    ON public.benefit_redemptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customer_benefits cb
            WHERE cb.id = benefit_id AND cb.customer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage benefit redemptions"
    ON public.benefit_redemptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid() AND customers.customer_type = 'ADMIN'
        )
    );

