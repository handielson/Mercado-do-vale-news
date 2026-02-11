-- Verificar campos que podem estar duplicados
-- entre campos fixos e campos personalizados

-- 1. Listar todos os campos personalizados (custom_fields)
SELECT 
    '=== CAMPOS PERSONALIZADOS (custom_fields) ===' as tipo,
    key,
    label,
    field_type,
    category
FROM custom_fields
ORDER BY label;

-- 2. Verificar campos fixos que estão configurados nas categorias
-- (imei1, imei2, serial, color, storage, ram, version, battery_health)
SELECT 
    '=== CAMPOS FIXOS CONFIGURADOS ===' as tipo,
    c.name as categoria,
    jsonb_object_keys(c.config) as campo_fixo
FROM categories c
WHERE c.name ILIKE '%celular%'
ORDER BY c.name;

-- 3. Verificar se há campos personalizados com nomes similares aos fixos
SELECT 
    '=== POSSÍVEIS DUPLICAÇÕES ===' as tipo,
    key,
    label,
    CASE 
        WHEN key ILIKE '%imei%' THEN '⚠️ Similar a campo fixo IMEI'
        WHEN key ILIKE '%serial%' THEN '⚠️ Similar a campo fixo Serial'
        WHEN key ILIKE '%cor%' OR key ILIKE '%color%' THEN '⚠️ Similar a campo fixo Color'
        WHEN key ILIKE '%armazenamento%' OR key ILIKE '%storage%' THEN '⚠️ Similar a campo fixo Storage'
        WHEN key ILIKE '%ram%' OR key ILIKE '%memoria%' THEN '⚠️ Similar a campo fixo RAM'
        WHEN key ILIKE '%versao%' OR key ILIKE '%version%' THEN '⚠️ Similar a campo fixo Version'
        WHEN key ILIKE '%bateria%' OR key ILIKE '%battery%' THEN '⚠️ Similar a campo fixo Battery Health'
        ELSE '✅ Único'
    END as status
FROM custom_fields
ORDER BY status DESC, label;
