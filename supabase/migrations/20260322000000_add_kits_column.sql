-- Adiciona suporte a Kits (preços progressivos por volume) diretamente na tabela de produtos
-- Formato esperado: [{"quantity": 5, "price": 45000, "name": "Kit 5"}]
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS kits JSONB DEFAULT '[]'::jsonb;

-- Comentário na tabela para documentar
COMMENT ON COLUMN public.products.kits IS 'Array de kits/descontos progressivos por volume. Ex: [{"quantity": 5, "price": 250000}]';

-- Se já existirem views que necessitem dessa nova coluna no futuro, atualize aqui.
