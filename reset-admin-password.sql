-- Script SQL para resetar a senha do usuário admin no PocketBase
-- Execute este script no PocketBase Admin UI ou via CLI

-- Nota: PocketBase armazena senhas com hash bcrypt
-- Você precisa executar este comando através da interface admin do PocketBase
-- ou usar a API REST com autenticação de admin

-- Informações do usuário:
-- ID: 09e2a74b-b0b4-4706-b91d-c410fc2fec3b
-- Email: handielson@example.com
-- CPF: 06329092427
-- Nova Senha: @@Jsj2865@@

-- INSTRUÇÕES PARA RESETAR A SENHA:

-- Opção 1: Via PocketBase Admin UI (RECOMENDADO)
-- 1. Acesse: http://127.0.0.1:8090/_/
-- 2. Faça login como admin do PocketBase
-- 3. Vá em Collections > users
-- 4. Encontre o usuário "Handielson" (ID: 09e2a74b-b0b4-4706-b91d-c410fc2fec3b)
-- 5. Clique no botão de editar (ícone de lápis)
-- 6. No campo "Password", digite: @@Jsj2865@@
-- 7. No campo "Password confirm", digite: @@Jsj2865@@
-- 8. Clique em "Save changes"

-- Opção 2: Via API REST (requer autenticação admin)
-- Use o seguinte comando curl:
-- curl -X PATCH http://127.0.0.1:8090/api/collections/users/records/09e2a74b-b0b4-4706-b91d-c410fc2fec3b \
--   -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
--   -H "Content-Type: application/json" \
--   -d '{"password":"@@Jsj2865@@","passwordConfirm":"@@Jsj2865@@"}'

-- Opção 3: Criar um novo usuário admin (se necessário)
-- Se você não conseguir acessar o PocketBase Admin, pode precisar recriar o banco de dados
-- ou usar o comando de reset do PocketBase
