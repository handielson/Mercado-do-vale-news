-- Migration robusta: remove constraints → renomeia dados → recria constraints → insere novos dados

BEGIN;

-- ─── 1. Remover TODOS os check constraints via pg_constraint (dinâmico) ───────
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'payment_fees'::regclass AND contype = 'c'
    LOOP
        EXECUTE format('ALTER TABLE payment_fees DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

-- ─── 2. Remover unique constraints (com e sem channel) ────────────────────────
ALTER TABLE payment_fees DROP CONSTRAINT IF EXISTS unique_payment_method_installments;
ALTER TABLE payment_fees DROP CONSTRAINT IF EXISTS unique_payment_method_installments_channel;

-- ─── 3. Adicionar coluna channel se não existir ───────────────────────────────
ALTER TABLE payment_fees
    ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'presencial';

-- ─── 4. Renomear 'online' → 'online_mp' ANTES de criar qualquer CHECK ─────────
--    (ADD CONSTRAINT valida linhas existentes — sem isso, 'online' violaria o novo check)
UPDATE payment_fees SET channel = 'online_mp' WHERE channel = 'online';

-- ─── 5. Recriar todos os check constraints ────────────────────────────────────
ALTER TABLE payment_fees
    ADD CONSTRAINT valid_operator_fee CHECK (operator_fee >= 0 AND operator_fee <= 100);

ALTER TABLE payment_fees
    ADD CONSTRAINT valid_applied_fee CHECK (applied_fee >= 0 AND applied_fee <= 100);

ALTER TABLE payment_fees
    ADD CONSTRAINT applied_greater_than_operator CHECK (applied_fee >= operator_fee);

ALTER TABLE payment_fees
    ADD CONSTRAINT valid_channel
    CHECK (channel IN ('presencial', 'online_mp', 'online_ps'));

-- ─── 6. Recriar unique constraint incluindo channel ───────────────────────────
ALTER TABLE payment_fees
    ADD CONSTRAINT unique_payment_method_installments_channel
    UNIQUE (company_id, payment_method, installments, channel);

-- ─── 7. Inserir Mercado Pago Online (online_mp) ───────────────────────────────
INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT c.id, 'debit', 1, 'online_mp', 'Mercado Pago', 1.49, 1.49
FROM companies c WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT c.id, 'pix', 1, 'online_mp', 'Mercado Pago', 0.99, 0.99
FROM companies c WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT
    c.id, 'credit', n, 'online_mp', 'Mercado Pago',
    CASE n WHEN 1 THEN 3.99 WHEN 2 THEN 4.99 WHEN 3 THEN 5.99 WHEN 4 THEN 6.99
           WHEN 5 THEN 7.99 WHEN 6 THEN 8.99 WHEN 7 THEN 9.99 WHEN 8 THEN 10.99
           WHEN 9 THEN 11.99 WHEN 10 THEN 12.99 WHEN 11 THEN 13.99 WHEN 12 THEN 14.99 ELSE 3.99 END,
    CASE n WHEN 1 THEN 3.99 WHEN 2 THEN 4.99 WHEN 3 THEN 5.99 WHEN 4 THEN 6.99
           WHEN 5 THEN 7.99 WHEN 6 THEN 8.99 WHEN 7 THEN 9.99 WHEN 8 THEN 10.99
           WHEN 9 THEN 11.99 WHEN 10 THEN 12.99 WHEN 11 THEN 13.99 WHEN 12 THEN 14.99 ELSE 3.99 END
FROM companies c CROSS JOIN generate_series(1, 12) AS n
WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

-- ─── 8. Inserir PagSeguro Online (online_ps) ──────────────────────────────────
INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT c.id, 'debit', 1, 'online_ps', 'PagSeguro', 1.99, 2
FROM companies c WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT c.id, 'pix', 1, 'online_ps', 'PagSeguro', 0.99, 1
FROM companies c WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

INSERT INTO payment_fees (company_id, payment_method, installments, channel, operator_name, operator_fee, applied_fee)
SELECT
    c.id, 'credit', n, 'online_ps', 'PagSeguro',
    CASE n WHEN 1 THEN 2.99 WHEN 2 THEN 3.99 WHEN 3 THEN 4.99 WHEN 4 THEN 5.99
           WHEN 5 THEN 6.99 WHEN 6 THEN 7.99 WHEN 7 THEN 8.99 WHEN 8 THEN 9.99
           WHEN 9 THEN 10.99 WHEN 10 THEN 11.99 WHEN 11 THEN 12.99 WHEN 12 THEN 13.99 ELSE 2.99 END,
    CASE n WHEN 1 THEN 4 WHEN 2 THEN 5 WHEN 3 THEN 6 WHEN 4 THEN 7
           WHEN 5 THEN 8 WHEN 6 THEN 9 WHEN 7 THEN 10 WHEN 8 THEN 11
           WHEN 9 THEN 12 WHEN 10 THEN 13 WHEN 11 THEN 14 WHEN 12 THEN 15 ELSE 4 END
FROM companies c CROSS JOIN generate_series(1, 12) AS n
WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, payment_method, installments, channel) DO NOTHING;

COMMIT;
