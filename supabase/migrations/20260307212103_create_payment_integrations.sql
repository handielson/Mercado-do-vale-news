CREATE TABLE IF NOT EXISTS public.payment_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    public_key TEXT,
    access_token TEXT,
    client_id TEXT,
    client_secret TEXT,
    environment TEXT NOT NULL DEFAULT 'sandbox',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, gateway_name)
);

-- Habilitar RLS
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuários autenticados podem visualizar as integrações"
    ON public.payment_integrations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuários autenticados podem inserir as integrações"
    ON public.payment_integrations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar as integrações"
    ON public.payment_integrations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar as integrações"
    ON public.payment_integrations FOR DELETE
    TO authenticated
    USING (true);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS set_payment_integrations_updated_at ON public.payment_integrations;
CREATE TRIGGER set_payment_integrations_updated_at
    BEFORE UPDATE ON public.payment_integrations
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
