-- View especializada para alimentar a Inteligência Artificial (n8n + OpenAI/Gemini)
-- Objetivo: Retornar dados extremamente enxutos para não sobrecarregar o painel da IA com tokens inúteis.

DROP VIEW IF EXISTS public.ai_product_catalog_view;

CREATE OR REPLACE VIEW public.ai_product_catalog_view AS
SELECT 
    p.id,
    p.name AS produto,
    c.name AS categoria,
    p.price_retail AS preco_varejo_centavos,
    p.price_wholesale AS preco_atacado_centavos,
    p.stock_quantity AS estoque_disponivel,
    p.specs AS especificacoes
FROM 
    public.products p
LEFT JOIN 
    public.categories c ON p.category_id = c.id
WHERE 
    p.status = 'active'
    AND p.track_inventory = true 
    AND p.stock_quantity > 0;

-- Concede acesso público à view (o n8n pode consumir usando a SUPABASE_ANON_KEY sem gerar tokens em excesso)
GRANT SELECT ON public.ai_product_catalog_view TO anon;
GRANT SELECT ON public.ai_product_catalog_view TO authenticated;
