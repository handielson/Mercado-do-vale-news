-- Inserir usuário admin no PocketBase (tabela users)
-- Este é o login para acessar /admin (não /cliente)
-- 
-- Credenciais:
-- CPF: 063.290.924-27
-- Senha: Jsj2865

-- Primeiro, verificar se já existe
DELETE FROM users WHERE cpf_cnpj = '06329092427';

-- Inserir admin
INSERT INTO users (
    id,
    name,
    email,
    client_type,
    cpf_cnpj,
    phone,
    password_hash,
    created_at,
    updated_at
) VALUES (
    '09e2a74b-b0b4-4706-b91d-c410fc2fec3b',
    'Handielson Amorim',
    'handielson@gmail.com',
    'ADMIN',
    '06329092427',
    '87998246812',
    '$2a$10$YourHashHere', -- Você precisará gerar o hash da senha
    NOW(),
    NOW()
);

-- Verificar
SELECT id, name, email, client_type, cpf_cnpj FROM users WHERE cpf_cnpj = '06329092427';
