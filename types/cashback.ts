// ============================================================
// TIPOS DO SISTEMA MOEDAS DO VALE
// ============================================================

export interface CashbackSettings {
    id: string;
    // Acúmulo
    coins_per_real: number;           // moedas por R$ gasto (ex: 1 = 1 moeda por R$)
    min_purchase_for_coins: number;   // pedido mínimo em R$ para ganhar moedas
    // Resgate
    coins_to_brl_rate: number;        // quantas moedas = R$ 1,00 (ex: 100 = 100 moedas/R$)
    max_redeem_percent: number;       // máx % do pedido pago com moedas (ex: 20)
    min_coins_to_redeem: number;      // saldo mínimo para resgatar
    // Indicação (Referral)
    coins_per_referral_purchase: number; // moedas ganhas por venda indicada (ex: 50)
    // Check-in
    checkin_base_coins: number;
    checkin_streak_milestones: CheckinMilestone[];
    // Expiração
    coins_expire_after_days: number | null; // null = nunca
    active: boolean;
    updated_at: string;
}

export interface CheckinMilestone {
    day: number;    // dia do streak (ex: 7)
    bonus: number;  // moedas extras (ex: 10)
}

export interface CoinBalance {
    id: string;
    customer_id: string;
    balance: number;        // saldo atual
    lifetime_earned: number;
    lifetime_spent: number;
    updated_at: string;
}

export type CoinTransactionType =
    | 'earn_purchase'
    | 'earn_checkin'
    | 'earn_streak'
    | 'earn_manual'
    | 'spend_discount'
    | 'refund_cancel'
    | 'expire'
    | 'earn_referral'
    | 'admin_adjust';

export type CoinReferenceType = 'sale' | 'quote' | 'checkin' | 'admin';

export interface CoinTransaction {
    id: string;
    customer_id: string;
    amount: number;           // positivo = ganhou, negativo = gastou
    type: CoinTransactionType;
    status: 'completed' | 'pending' | 'cancelled';
    description: string | null;
    reference_id: string | null;
    reference_type: CoinReferenceType | null;
    created_at: string;
}

export interface CheckinLog {
    id: string;
    customer_id: string;
    checkin_date: string;  // DATE (YYYY-MM-DD)
    coins_earned: number;
    streak_day: number;
    created_at: string;
}

// Resultado de tentativa de check-in
export interface CheckinResult {
    success: boolean;
    alreadyCheckedIn: boolean;
    coins_earned: number;
    streak_day: number;
    next_milestone?: CheckinMilestone;
    error?: string;
}

// Resultado de validação de resgate
export interface RedeemValidation {
    valid: boolean;
    error?: string;
    coins_to_use: number;
    discount_brl: number;   // desconto em R$
    final_price: number;    // preço final após desconto
}
