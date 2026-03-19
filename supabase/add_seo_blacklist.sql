-- Script para adicionar coluna de Lista Negra SEO (Ocultar do Google)
-- Copie e cole este código no SQL Editor do seu Supabase Dashboard e clique em RUN.

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS exclude_from_seo BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.products.exclude_from_seo IS 'Se verdadeiro (true), adiciona uma meta tag noindex na página pública do produto bloqueando-o no Google.';
