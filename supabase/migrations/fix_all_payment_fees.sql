-- Verificar os valores atuais de applied_fee na tabela payment_fees
SELECT 
    id,
    installments,
    payment_method,
    applied_fee,
    operator_fee,
    company_id
FROM payment_fees
WHERE payment_method = 'credit'
ORDER BY installments;

-- Se os valores estiverem incorretos, execute os UPDATEs abaixo:
-- IMPORTANTE: applied_fee deve ser >= operator_fee (constraint do banco)

-- Corrigir 2x (operator: 2%, applied: 3%)
UPDATE payment_fees
SET operator_fee = 2, applied_fee = 3
WHERE payment_method = 'credit' AND installments = 2;

-- Corrigir 3x (operator: 3%, applied: 5%)
UPDATE payment_fees
SET operator_fee = 3, applied_fee = 5
WHERE payment_method = 'credit' AND installments = 3;

-- Corrigir 6x (operator: 5%, applied: 8%)
UPDATE payment_fees
SET operator_fee = 5, applied_fee = 8
WHERE payment_method = 'credit' AND installments = 6;

-- Corrigir 12x (operator: 12%, applied: 18%)
UPDATE payment_fees
SET operator_fee = 12, applied_fee = 18
WHERE payment_method = 'credit' AND installments = 12;

-- Corrigir 18x (operator: 10%, applied: 15%)
UPDATE payment_fees
SET operator_fee = 10, applied_fee = 15
WHERE payment_method = 'credit' AND installments = 18;

-- Verificar novamente após as correções
SELECT 
    installments,
    applied_fee,
    operator_fee
FROM payment_fees
WHERE payment_method = 'credit'
ORDER BY installments;
