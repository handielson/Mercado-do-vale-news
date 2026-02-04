-- Corrigir taxa de 12x de 12% para 18%
UPDATE payment_fees
SET applied_fee = 18
WHERE payment_method = 'credit'
  AND installments = 12
  AND applied_fee = 12;

-- Verificar os valores atuais
SELECT 
    installments,
    applied_fee,
    operator_fee
FROM payment_fees
WHERE payment_method = 'credit'
ORDER BY installments;
