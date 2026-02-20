import { supabase } from './supabase';
import type {
    CashbackSettings,
    CoinBalance,
    CoinTransaction,
    CoinTransactionType,
    RedeemValidation,
} from '../types/cashback';

// ============================================================
// CONFIGURAÇÕES
// ============================================================

export async function getCashbackSettings(): Promise<CashbackSettings> {
    const { data, error } = await supabase
        .from('cashback_settings')
        .select('*')
        .single();

    if (error) throw new Error(`Erro ao buscar configurações de cashback: ${error.message}`);
    return data as CashbackSettings;
}

export async function updateCashbackSettings(
    updates: Partial<CashbackSettings>
): Promise<CashbackSettings> {
    const { data, error } = await supabase
        .from('cashback_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000') // atualiza a única linha
        .select()
        .single();

    if (error) throw new Error(`Erro ao salvar configurações: ${error.message}`);
    return data as CashbackSettings;
}

// ============================================================
// SALDO
// ============================================================

export async function getCoinBalance(customerId: string): Promise<CoinBalance | null> {
    const { data, error } = await supabase
        .from('coin_balances')
        .select('*')
        .eq('customer_id', customerId)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data as CoinBalance | null;
}

export async function getOrCreateBalance(customerId: string): Promise<CoinBalance> {
    const existing = await getCoinBalance(customerId);
    if (existing) return existing;

    const { data, error } = await supabase
        .from('coin_balances')
        .insert({ customer_id: customerId, balance: 0, lifetime_earned: 0, lifetime_spent: 0 })
        .select()
        .single();

    if (error) throw new Error(`Erro ao criar saldo: ${error.message}`);
    return data as CoinBalance;
}

// ============================================================
// HISTÓRICO DE TRANSAÇÕES
// ============================================================

export async function getCoinTransactions(
    customerId: string,
    limit = 20
): Promise<CoinTransaction[]> {
    const { data, error } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Erro ao buscar transações: ${error.message}`);
    return (data ?? []) as CoinTransaction[];
}

// Admin: todas as transações com filtros
export async function listAllTransactions(filters?: {
    type?: CoinTransactionType;
    from?: string;
    to?: string;
    limit?: number;
}): Promise<CoinTransaction[]> {
    let query = supabase
        .from('coin_transactions')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 100);

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.from) query = query.gte('created_at', filters.from);
    if (filters?.to) query = query.lte('created_at', filters.to);

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao listar transações: ${error.message}`);
    return (data ?? []) as CoinTransaction[];
}

// ============================================================
// ACÚMULO — APÓS COMPRA
// ============================================================

/**
 * Acumula moedas para um cliente após uma compra.
 *
 * ⚠️ REGRA CRÍTICA: `finalPaidBrl` deve ser o valor FINAL PAGO pelo cliente,
 * ou seja, APÓS subtrair cupom de desconto e moedas resgatadas.
 * Nunca passar o valor bruto do pedido — isso geraria duplicidade de desconto.
 *
 * Exemplo correto:
 *   Pedido R$ 100 - cupom R$ 20 - moedas R$ 5 = R$ 75 pago → cashback sobre R$ 75
 */
export async function earnCoinsForPurchase(
    customerId: string,
    finalPaidBrl: number,  // Valor FINAL pago — depois de todos os descontos
    saleId: string
): Promise<number> {
    const settings = await getCashbackSettings();

    if (!settings.active) return 0;
    if (finalPaidBrl < 0.01) return 0; // Compra zerada por descontos não gera cashback
    if (finalPaidBrl < settings.min_purchase_for_coins) return 0;

    const coinsEarned = Math.floor(finalPaidBrl * settings.coins_per_real);
    if (coinsEarned <= 0) return 0;

    const { error } = await supabase.rpc('add_coins', {
        p_customer_id: customerId,
        p_amount: coinsEarned,
        p_type: 'earn_purchase',
        p_description: `Compra aprovada — R$ ${finalPaidBrl.toFixed(2).replace('.', ',')}`,
        p_reference_id: saleId,
        p_reference_type: 'sale',
    });

    if (error) throw new Error(`Erro ao creditar moedas: ${error.message}`);
    return coinsEarned;
}

// ============================================================
// VALIDAR RESGATE
// ============================================================

export async function validateCoinRedeem(
    customerId: string,
    coinsToUse: number,
    orderValueBrl: number // em R$
): Promise<RedeemValidation> {
    const settings = await getCashbackSettings();
    const balance = await getCoinBalance(customerId);

    if (!settings.active) {
        return { valid: false, error: 'Sistema de moedas inativo', coins_to_use: 0, discount_brl: 0, final_price: orderValueBrl };
    }
    if (!balance || balance.balance < settings.min_coins_to_redeem) {
        return { valid: false, error: `Saldo mínimo para resgate: ${settings.min_coins_to_redeem} moedas`, coins_to_use: 0, discount_brl: 0, final_price: orderValueBrl };
    }
    if (coinsToUse > balance.balance) {
        return { valid: false, error: 'Saldo insuficiente', coins_to_use: 0, discount_brl: 0, final_price: orderValueBrl };
    }

    // Cap: desconto máximo = max_redeem_percent% do pedido
    const maxDiscountBrl = (orderValueBrl * settings.max_redeem_percent) / 100;
    const rawDiscountBrl = coinsToUse / settings.coins_to_brl_rate;
    const discountBrl = Math.min(rawDiscountBrl, maxDiscountBrl);
    const effectiveCoins = Math.ceil(discountBrl * settings.coins_to_brl_rate);

    return {
        valid: true,
        coins_to_use: effectiveCoins,
        discount_brl: parseFloat(discountBrl.toFixed(2)),
        final_price: parseFloat((orderValueBrl - discountBrl).toFixed(2)),
    };
}

// ============================================================
// EXECUTAR RESGATE
// ============================================================

export async function redeemCoins(
    customerId: string,
    coinsToUse: number,
    description: string,
    referenceId?: string,
    referenceType: 'sale' | 'quote' = 'quote'
): Promise<void> {
    const { error } = await supabase.rpc('spend_coins', {
        p_customer_id: customerId,
        p_amount: coinsToUse,
        p_type: 'spend_discount',
        p_description: description,
        p_reference_id: referenceId ?? null,
        p_reference_type: referenceType,
    });

    if (error) throw new Error(error.message);
}

// ============================================================
// ESTORNO (CANCELAMENTO)
// ============================================================

export async function refundCoinsOnCancel(
    customerId: string,
    coinsToRefund: number,
    saleId: string
): Promise<void> {
    const { error } = await supabase.rpc('refund_coins', {
        p_customer_id: customerId,
        p_amount: coinsToRefund,
        p_reference_id: saleId,
    });

    if (error) throw new Error(`Erro ao estornar moedas: ${error.message}`);
}

// ============================================================
// AJUSTE MANUAL (ADMIN)
// ============================================================

export async function adminAdjustCoins(
    customerId: string,
    amount: number, // positivo = adicionar, negativo = remover
    reason: string
): Promise<void> {
    const rpc = amount > 0 ? 'add_coins' : 'spend_coins';
    const { error } = await supabase.rpc(rpc, {
        p_customer_id: customerId,
        p_amount: Math.abs(amount),
        p_type: 'admin_adjust',
        p_description: reason,
        p_reference_type: 'admin',
    });

    if (error) throw new Error(`Erro no ajuste: ${error.message}`);
}

// ============================================================
// HELPERS
// ============================================================

/** Converte moedas em R$ com base nas settings */
export function coinsToReais(coins: number, rate: number): number {
    return parseFloat((coins / rate).toFixed(2));
}

/** Converte R$ em moedas com base nas settings */
export function reaisToCoins(brl: number, coinsPerReal: number): number {
    return Math.floor(brl * coinsPerReal);
}
