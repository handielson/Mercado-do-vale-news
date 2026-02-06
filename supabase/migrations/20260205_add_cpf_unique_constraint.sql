-- Add unique constraint to CPF/CNPJ field and update admin CPF
-- This ensures one account per CPF/CNPJ

-- First, check if there are any duplicate CPF/CNPJ values
SELECT cpf_cnpj, COUNT(*) as count 
FROM users 
WHERE cpf_cnpj IS NOT NULL 
GROUP BY cpf_cnpj 
HAVING COUNT(*) > 1;

-- Update admin user CPF
UPDATE users 
SET cpf_cnpj = '06329092427', updated_at = NOW()
WHERE id = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';

-- Add unique constraint to cpf_cnpj column
-- This will prevent duplicate CPF/CNPJ registrations
ALTER TABLE users 
ADD CONSTRAINT users_cpf_cnpj_unique UNIQUE (cpf_cnpj);

-- Verify the changes
SELECT id, name, email, cpf_cnpj, client_type 
FROM users 
WHERE id = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';
