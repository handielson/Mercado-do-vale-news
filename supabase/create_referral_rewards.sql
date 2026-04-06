-- Adiciona coluna de código de indicação na tabela de clientes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Gera código aleatório no formato MV-XXXXX para os clientes existentes que não têm
UPDATE customers 
SET referral_code = 'MV-' || UPPER(SUBSTRING(MD5(id::text || random()::text) FROM 1 FOR 5))
WHERE referral_code IS NULL;

-- Adiciona campo de recompensa por indicação convertida
ALTER TABLE cashback_settings ADD COLUMN IF NOT EXISTS coins_per_referral_purchase INTEGER DEFAULT 50;

-- Cria uma function RPC para validar e premiar a indicação que foi fechada com a venda
CREATE OR REPLACE FUNCTION process_referral_reward(
    p_referral_code TEXT,
    p_sale_id UUID,
    p_buyer_name TEXT
) RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_coins_reward INTEGER;
    v_settings cashback_settings%ROWTYPE;
    v_transaction_id UUID;
    v_company_id UUID;
    v_buyer_id UUID;
BEGIN
    -- 1. Buscar quem é o dono do código de indicação
    SELECT id, company_id INTO v_referrer_id, v_company_id
    FROM customers 
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de indicação não encontrado');
    END IF;

    -- 2. Verificar se o dono do código é o próprio comprador
    SELECT customer_id INTO v_buyer_id 
    FROM sales 
    WHERE id = p_sale_id;

    IF v_buyer_id = v_referrer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente não pode indicar a si mesmo');
    END IF;

    -- 3. Buscar configurações ativas de cashback
    SELECT * INTO v_settings 
    FROM cashback_settings 
    WHERE company_id = v_company_id AND active = true;

    IF v_settings IS NULL OR v_settings.coins_per_referral_purchase <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recompensas de indicação desativadas');
    END IF;

    v_coins_reward := v_settings.coins_per_referral_purchase;

    -- 4. Inserir a transação de ganho para o Referenciador (earn_referral)
    -- Atenção: se 'earn_referral' não existir no seu tipo ENUM atual, 
    -- nós usamos 'earn_manual' para contornar, ou alteramos o enum.
    -- Vamos tentar usar 'earn_manual' com uma descrição muito clara para facilitar.
    
    INSERT INTO coin_transactions (
        customer_id, 
        amount, 
        type, 
        description, 
        reference_id, 
        reference_type
    ) VALUES (
        v_referrer_id, 
        v_coins_reward, 
        'earn_manual', 
        'Indicação convertida: Venda #' || left(p_sale_id::text, 8) || ' para ' || p_buyer_name, 
        p_sale_id, 
        'sale'
    ) RETURNING id INTO v_transaction_id;

    -- 5. Atualizar ou criar saldo do Referenciador
    INSERT INTO coin_balances (
        customer_id, balance, lifetime_earned, lifetime_spent
    ) VALUES (
        v_referrer_id, v_coins_reward, v_coins_reward, 0
    ) ON CONFLICT (customer_id) 
    DO UPDATE SET 
        balance = coin_balances.balance + v_coins_reward,
        lifetime_earned = coin_balances.lifetime_earned + v_coins_reward,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true, 
        'coins_awarded', v_coins_reward,
        'referrer_id', v_referrer_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
