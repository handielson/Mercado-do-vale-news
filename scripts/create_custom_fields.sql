-- Script SQL para criar os 4 custom fields faltantes
-- Campos: main_camera_mpx, selfie_camera_mpx, processor, network
-- Categoria: spec (especificações técnicas)
-- Company ID: 9717131e-7b14-4aec-84a4-4317c0489985

-- 1. Câmera Principal (Mpx)
INSERT INTO custom_fields (
    id,
    company_id,
    key,
    label,
    category,
    field_type,
    options,
    validation,
    placeholder,
    help_text,
    is_system,
    display_order,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '9717131e-7b14-4aec-84a4-4317c0489985',
    'main_camera_mpx',
    'Câm. Principal (Mpx)',
    'spec',
    'text',
    '[]'::jsonb,
    '{}'::jsonb,
    '108mp',
    'Resolução da câmera principal em megapixels',
    false,
    100,
    NOW(),
    NOW()
);

-- 2. Câmera Selfie (Mpx)
INSERT INTO custom_fields (
    id,
    company_id,
    key,
    label,
    category,
    field_type,
    options,
    validation,
    placeholder,
    help_text,
    is_system,
    display_order,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '9717131e-7b14-4aec-84a4-4317c0489985',
    'selfie_camera_mpx',
    'Câm. Selfie (Mpx)',
    'spec',
    'text',
    '[]'::jsonb,
    '{}'::jsonb,
    '16',
    'Resolução da câmera frontal em megapixels',
    false,
    101,
    NOW(),
    NOW()
);

-- 3. Processador
INSERT INTO custom_fields (
    id,
    company_id,
    key,
    label,
    category,
    field_type,
    options,
    validation,
    placeholder,
    help_text,
    is_system,
    display_order,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '9717131e-7b14-4aec-84a4-4317c0489985',
    'processor',
    'Processador',
    'spec',
    'text',
    '[]'::jsonb,
    '{}'::jsonb,
    'snapdragon',
    'Nome do processador do dispositivo',
    false,
    102,
    NOW(),
    NOW()
);

-- 4. Rede (4G ou 5G)
INSERT INTO custom_fields (
    id,
    company_id,
    key,
    label,
    category,
    field_type,
    options,
    validation,
    placeholder,
    help_text,
    is_system,
    display_order,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '9717131e-7b14-4aec-84a4-4317c0489985',
    'network',
    '4G ou 5G',
    'spec',
    'text',
    '[]'::jsonb,
    '{}'::jsonb,
    '4G | 5G',
    'Tipo de rede móvel suportada',
    false,
    103,
    NOW(),
    NOW()
);

-- Verificar se os campos foram criados
SELECT key, label, category, field_type, is_system 
FROM custom_fields 
WHERE key IN ('main_camera_mpx', 'selfie_camera_mpx', 'processor', 'network')
ORDER BY display_order;

