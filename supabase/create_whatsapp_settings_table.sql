-- Habilitando a extensão obrigatória para o automatismo de timestamp
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    phone_number TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativando RLS para segurança
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
DROP POLICY IF EXISTS "whatsapp_settings_select_policy" ON public.whatsapp_settings;
CREATE POLICY "whatsapp_settings_select_policy" 
ON public.whatsapp_settings FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "whatsapp_settings_insert_policy" ON public.whatsapp_settings;
CREATE POLICY "whatsapp_settings_insert_policy" 
ON public.whatsapp_settings FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_settings_update_policy" ON public.whatsapp_settings;
CREATE POLICY "whatsapp_settings_update_policy" 
ON public.whatsapp_settings FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_settings_delete_policy" ON public.whatsapp_settings;
CREATE POLICY "whatsapp_settings_delete_policy" 
ON public.whatsapp_settings FOR DELETE 
TO authenticated 
USING (true);

-- Trigger de updated_at automático
DROP TRIGGER IF EXISTS handle_updated_at ON public.whatsapp_settings;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.whatsapp_settings 
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- Seed básico: Insere apenas uma linha em cache caso não tenha
INSERT INTO public.whatsapp_settings (api_url, api_key, instance_name, phone_number, is_active)
SELECT '', '', '', '', false
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings);
