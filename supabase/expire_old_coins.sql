-- ============================================================
-- EXPIRAÇÃO DINÂMICA DE MOEDAS (FIFO)
-- ============================================================
-- Função que expira moedas baseadas na data em que foram ganhas.

CREATE OR REPLACE FUNCTION expire_old_coins()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_expire_days INTEGER;
    c RECORD;
    v_total_earned_old INTEGER;
    v_total_spent_or_expired INTEGER;
    v_amount_to_expire INTEGER;
BEGIN
    -- Obter a configuração de validade das moedas
    SELECT coins_expire_after_days INTO v_expire_days
    FROM cashback_settings LIMIT 1;

    -- Se não estiver configurado ou for 0, não faz nada (moedas não expiram)
    IF v_expire_days IS NULL OR v_expire_days <= 0 THEN
        RETURN;
    END IF;

    -- Loop em todos os clientes que possuem saldo > 0
    FOR c IN SELECT customer_id, balance FROM coin_balances WHERE balance > 0 LOOP
        
        -- 1. Calcular o total ganho "velho" (que foi ganho há mais de X dias)
        SELECT COALESCE(SUM(amount), 0) INTO v_total_earned_old
        FROM coin_transactions
        WHERE customer_id = c.customer_id 
          AND amount > 0 
          AND created_at <= (now() - (v_expire_days || ' days')::interval);

        -- 2. Calcular o total de tudo que o cliente já gastou, teve expirado ou removido pelo admin
        -- (Tudo que é negativo no transaction ledger serve como dedução)
        SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_spent_or_expired
        FROM coin_transactions
        WHERE customer_id = c.customer_id 
          AND amount < 0;

        -- 3. Se o Ganho Velho for maior que o Total Gasto, a diferença são moedas que estão paradas
        IF v_total_earned_old > v_total_spent_or_expired THEN
            v_amount_to_expire := v_total_earned_old - v_total_spent_or_expired;

            -- O cap máximo de expiração é o próprio saldo do cliente (por precaução)
            IF v_amount_to_expire > c.balance THEN
                v_amount_to_expire := c.balance;
            END IF;
            
            IF v_amount_to_expire > 0 THEN
                -- Deduzir as moedas do saldo do cliente
                UPDATE coin_balances
                SET balance = balance - v_amount_to_expire,
                    updated_at = now()
                WHERE customer_id = c.customer_id;

                -- Inserir a transação de expiração
                INSERT INTO coin_transactions(customer_id, amount, type, description, status)
                VALUES (c.customer_id, -v_amount_to_expire, 'expire', 'Moedas expiradas (validade atingida)', 'completed');
            END IF;
        END IF;
    END LOOP;
END;
$$;
