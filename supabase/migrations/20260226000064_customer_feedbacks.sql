-- Table: customer_feedbacks
CREATE TABLE IF NOT EXISTS public.customer_feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Dúvida', 'Reclamação', 'Sugestão', 'Outro')),
    message TEXT NOT NULL,
    customer_name TEXT,
    customer_contact TEXT,
    status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'lido', 'respondido')),
    admin_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.customer_feedbacks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow INSERT for anonymous users (Public can submit feedback)
CREATE POLICY "Enable insert for everyone" ON public.customer_feedbacks
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow SELECT for ADMIN users only
CREATE POLICY "Enable select for admin customers users" ON public.customer_feedbacks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
            AND customers.company_id = customer_feedbacks.company_id
        )
    );

-- Policy: Allow UPDATE for ADMIN users only
CREATE POLICY "Enable update for admin customers users" ON public.customer_feedbacks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
            AND customers.company_id = customer_feedbacks.company_id
        )
    );

-- Policy: Allow DELETE for ADMIN users only
CREATE POLICY "Enable delete for admin customers users" ON public.customer_feedbacks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.customers
            WHERE customers.id = auth.uid()
            AND customers.customer_type = 'ADMIN'
            AND customers.company_id = customer_feedbacks.company_id
        )
    );
