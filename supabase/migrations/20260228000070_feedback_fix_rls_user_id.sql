-- Migration: Fix RLS SELECT policy for customer_feedbacks
-- O projeto usa customers.user_id para linkar ao auth (NÃO customers.id).
-- A policy anterior usava customers.id = auth.uid() que nunca matchava,
-- fazendo o admin receber array vazio mesmo sendo ADMIN.

DROP POLICY IF EXISTS "Enable select for admin customers users" ON public.customer_feedbacks;
DROP POLICY IF EXISTS "Enable update for admin customers users" ON public.customer_feedbacks;
DROP POLICY IF EXISTS "Enable delete for admin customers users" ON public.customer_feedbacks;

-- SELECT: Admin vê todos os feedbacks
CREATE POLICY "Enable select for admin customers users" ON public.customer_feedbacks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );

-- UPDATE: Admin pode atualizar (marcar como lido, responder)
CREATE POLICY "Enable update for admin customers users" ON public.customer_feedbacks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );

-- DELETE: Admin pode excluir
CREATE POLICY "Enable delete for admin customers users" ON public.customer_feedbacks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.user_id = auth.uid()
            AND customers.customer_type = 'ADMIN'
        )
    );
