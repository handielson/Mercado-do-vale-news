-- Fix for RLS Policies for Customer Feedbacks
-- Remove the strict company_id match for Admin users, since auth.uid() matching 'ADMIN' in customers is secure enough globally.

DROP POLICY IF EXISTS "Enable select for admin customers users" ON public.customer_feedbacks;
DROP POLICY IF EXISTS "Enable update for admin customers users" ON public.customer_feedbacks;
DROP POLICY IF EXISTS "Enable delete for admin customers users" ON public.customer_feedbacks;

-- Policy: Allow SELECT for ADMIN users
CREATE POLICY "Enable select for admin customers users" ON public.customer_feedbacks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );

-- Policy: Allow UPDATE for ADMIN users
CREATE POLICY "Enable update for admin customers users" ON public.customer_feedbacks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );

-- Policy: Allow DELETE for ADMIN users
CREATE POLICY "Enable delete for admin customers users" ON public.customer_feedbacks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );
