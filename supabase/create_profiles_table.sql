-- Cria a tabela profiles (caso não exista) para ligar usuarios ao company_id
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
    role text DEFAULT 'admin',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Habilita RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política: admin loga e pode ver/editar seu próprio perfil
CREATE POLICY IF NOT EXISTS "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Service role can manage profiles"
    ON public.profiles FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insere o perfil do admin (ajuste o userId e o company_id manualmente se necessário)
-- Este INSERT é seguro: não vai sobrescrever caso já exista (ON CONFLICT DO NOTHING)
INSERT INTO public.profiles (id, company_id)
SELECT 
    '6d0eee93-e59f-41eb-877f-18e7e7ea085f'::uuid,
    id
FROM public.companies
WHERE slug = 'mercado-do-vale'
ON CONFLICT (id) DO NOTHING;
