-- Buscar "Poco C85" em TODAS as tabelas do Supabase

-- 1. Tabela: models (PRINCIPAL)
SELECT 'models' as tabela, id, name, template_values
FROM models
WHERE name ILIKE '%Poco C85%';

-- 2. Ver template_values formatado
SELECT 
    name,
    jsonb_pretty(template_values) as especificacoes
FROM models
WHERE name ILIKE '%Poco C85%';

-- 3. Tabela: model_eans (EANs associados)
SELECT 'model_eans' as tabela, me.*, m.name as model_name
FROM model_eans me
JOIN models m ON m.id = me.model_id
WHERE m.name ILIKE '%Poco C85%';

-- 4. Tabela: model_variants (variantes)
SELECT 'model_variants' as tabela, mv.*, m.name as model_name
FROM model_variants mv
JOIN models m ON m.id = mv.model_id
WHERE m.name ILIKE '%Poco C85%';

-- 5. Tabela: products (produtos com este modelo)
SELECT 'products' as tabela, p.id, p.model_id, m.name as model_name
FROM products p
JOIN models m ON m.id = p.model_id
WHERE m.name ILIKE '%Poco C85%';