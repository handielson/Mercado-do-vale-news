-- Script para verificar e garantir permissão ADMIN para o editor de catálogo

-- 1. Verificar usuários atuais e seus tipos
SELECT 
    id,
    name,
    email,
    client_type,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Se você souber seu email, atualize para ADMIN:
-- SUBSTITUA 'seu-email@exemplo.com' pelo seu email real
UPDATE users
SET client_type = 'ADMIN', updated_at = NOW()
WHERE email = 'seu-email@exemplo.com';

-- 3. Verificar a atualização
SELECT id, name, email, client_type
FROM users
WHERE client_type = 'ADMIN';

-- 4. Se preferir atualizar pelo CPF/CNPJ:
-- UPDATE users
-- SET client_type = 'ADMIN', updated_at = NOW()
-- WHERE cpf_cnpj = 'SEU_CPF_AQUI';
