-- 1. Adicionar nova configuração de multiplicador para indicações
ALTER TABLE cashback_settings
ADD COLUMN IF NOT EXISTS referral_coins_per_real NUMERIC(10,4) NOT NULL DEFAULT 0.50;

-- 2. Atualizar a RPC process_referral_reward para calcular proporcionalmente e registrar a venda online
CREATE OR REPLACE FUNCTION process_referral_reward(
    p_referral_code TEXT,
    p_buyer_id UUID,
    p_purchase_value NUMERIC,
    p_reference_id UUID,
    p_reference_type TEXT, -- 'sale' ou 'order'
    p_buyer_name TEXT
) RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_coins_reward INTEGER;
    v_settings cashback_settings%ROWTYPE;
    v_transaction_id UUID;
BEGIN
    -- 1. Buscar quem é o dono do código de indicação
    SELECT id INTO v_referrer_id
    FROM customers 
    WHERE referral_code = p_referral_code;

    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de indicação não encontrado');
    END IF;

    -- 2. Verificar se o dono do código é o próprio comprador
    IF p_buyer_id = v_referrer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente não pode indicar a si mesmo');
    END IF;

    -- 3. Buscar configurações ativas de cashback (assumimos a primeira ou única config global, mas usamos a lógica existente)
    SELECT * INTO v_settings 
    FROM cashback_settings 
    WHERE active = true
    LIMIT 1;

    IF v_settings IS NULL OR v_settings.referral_coins_per_real <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recompensas de indicação desativadas');
    END IF;

    -- 4. Calcular moedas proporcionais ao valor da compra
    v_coins_reward := FLOOR(p_purchase_value * v_settings.referral_coins_per_real);

    IF v_coins_reward <= 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Recompensa calculada é zero para o valor da compra');
    END IF;

    -- 5. Inserir a transação de ganho para o Referenciador (earn_manual usado como fallback de 'earn_referral')
    INSERT INTO coin_transactions (
        customer_id, 
        amount, 
        type, 
        description, 
        reference_id, 
        reference_type,
        status
    ) VALUES (
        v_referrer_id, 
        v_coins_reward, 
        'earn_manual', 
        'Indicação convertida: Venda/Pedido #' || left(p_reference_id::text, 8) || ' (' || p_buyer_name || ')', 
        p_reference_id, 
        p_reference_type,
        'completed'
    ) RETURNING id INTO v_transaction_id;

    -- 6. Atualizar ou criar saldo do Referenciador
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

-- 3. Criar RPC para estornar moedas do referenciador em caso de cancelamento
CREATE OR REPLACE FUNCTION refund_referral_coins(
    p_reference_id UUID
) RETURNS JSONB AS $$
DECLARE
    tx RECORD;
    v_refunded BOOLEAN := false;
BEGIN
    -- Buscar todas as transações que representam a recompensa de indicacao desta venda especifica
    -- Filtrando apenas pelos 'earn_manual' com esse reference_id
    FOR tx IN 
        SELECT * FROM coin_transactions 
        WHERE reference_id = p_reference_id 
          AND amount > 0 
          AND status = 'completed'
          AND description LIKE 'Indicação convertida%'
    LOOP
        -- Remover o saldo do cliente (referenciador)
        UPDATE coin_balances
        SET balance = GREATEST(0, balance - tx.amount),
            lifetime_earned = GREATEST(0, lifetime_earned - tx.amount),
            updated_at = NOW()
        WHERE customer_id = tx.customer_id;

        -- Registrar transação de estorno
        INSERT INTO coin_transactions(
            customer_id, amount, type, description, reference_id, reference_type, status
        ) VALUES (
            tx.customer_id, 
            -tx.amount, 
            'refund_cancel', 
            'Estorno por cancelamento de venda indicada #' || left(p_reference_id::text, 8), 
            p_reference_id, 
            tx.reference_type,
            'completed'
        );
        
        v_refunded := true;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'refunded', v_refunded);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Adicionar colunas referral_code e referral_name na tabela orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referral_name TEXT;
