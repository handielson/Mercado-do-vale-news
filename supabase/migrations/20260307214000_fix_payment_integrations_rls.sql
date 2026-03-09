ALTER POLICY "Usuários autenticados podem visualizar as integrações" ON public.payment_integrations USING (true);
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar as integrações" ON public.payment_integrations;

CREATE POLICY "Qualquer pessoa pode visualizar as integrações"
    ON public.payment_integrations FOR SELECT
    USING (true);

NOTIFY pgrst, 'reload schema';
