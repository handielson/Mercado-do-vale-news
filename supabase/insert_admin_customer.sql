-- Inserir admin na tabela customers
-- User ID do auth.users: 6d0eee93-e59f-41eb-877f-18e7e7ea085f

INSERT INTO customers (
    user_id,
    company_id,
    name,
    email,
    cpf_cnpj,
    phone,
    customer_type,
    created_at,
    updated_at
) VALUES (
    '6d0eee93-e59f-41eb-877f-18e7e7ea085f',
    '00000000-0000-0000-0000-000000000001', -- Admin company ID
    'Handielson Amorim',
    'handielson@gmail.com',
    '06329092427',
    '87998246812',
    'ADMIN',
    NOW(),
    NOW()
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    customer_type = 'ADMIN',
    updated_at = NOW();

-- Verificar se foi criado
SELECT 
    id,
    user_id,
    name,
    email,
    customer_type,
    created_at
FROM customers 
WHERE user_id = '6d0eee93-e59f-41eb-877f-18e7e7ea085f';
