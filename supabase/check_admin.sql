-- Verificar se o admin existe na tabela customers
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.customer_type,
    c.created_at,
    au.email as auth_email
FROM customers c
LEFT JOIN auth.users au ON c.user_id = au.id
WHERE c.email = 'handielson@gmail.com' OR au.email = 'handielson@gmail.com';

-- Se não existir, vamos criar
-- Primeiro, pegar o user_id do auth.users
SELECT id, email FROM auth.users WHERE email = 'handielson@gmail.com';
