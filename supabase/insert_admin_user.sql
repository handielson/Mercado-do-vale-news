-- Inserir dados do usuário admin na tabela users
-- User ID do Supabase Auth: 09e2a74b-b0b4-4706-b91d-c410fc2fec3b

INSERT INTO users (
    id,
    name,
    email,
    client_type,
    cpf_cnpj,
    phone,
    created_at,
    updated_at
) VALUES (
    '09e2a74b-b0b4-4706-b91d-c410fc2fec3b',
    'Handielson',
    'handielson@example.com',
    'ATACADO', -- Tipo de cliente admin (ATACADO tem acesso total)
    '00000000000', -- CPF placeholder
    '00000000000', -- Telefone placeholder
    NOW(),
    NOW()
);

-- Verificar se o usuário foi inserido
SELECT * FROM users WHERE id = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';
