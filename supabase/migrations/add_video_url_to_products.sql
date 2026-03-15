-- Adiciona a coluna video_url na tabela products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Atualiza a view, se necessário
-- Se products for consultado diretamente, o supabase já pega.
