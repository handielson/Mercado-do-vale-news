import { vpsClient } from './vpsClient';
import type {
    CashbackSettings,
    CoinBalance,
    CoinTransaction,
    CoinTransactionType,
    CoinReferenceType,
    RedeemValidation,
} from '../types/cashback';

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };
type CustomerSummary = { id: string; name?: string | null; referral_code?: string | null };

function createLocalId(prefix = 'coin'): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadTableRows<T>(table: string, pageSize = 200): Promise<T[]> {
    let offset = 0;
    const rows: T[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function loadCoinTransactions(): Promise<CoinTransaction[]> {
    let offset = 0;
    const pageSize = 200;
    const rows: CoinTransaction[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CoinTransaction>>(
            `/table-data/coin_transactions?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function loadCoinBalances(): Promise<CoinBalance[]> {
    let offset = 0;
    const pageSize = 200;
    const rows: CoinBalance[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CoinBalance>>(
            `/table-data/coin_balances?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function loadCashbackSettings(): Promise<CashbackSettings[]> {
    let offset = 0;
    const pageSize = 200;
    const rows: CashbackSettings[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CashbackSettings>>(
            `/table-data/cashback_settings?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

function sortTransactionsNewestFirst(transactions: CoinTransaction[]): CoinTransaction[] {
    return [...transactions].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

// ============================================================
// CONFIGURAÃ‡Ã•ES
// ============================================================

export async function getCashbackSettings(): Promise<CashbackSettings> {
    const settings = await loadCashbackSettings();
    const current = settings[0];

    if (!current) {
        throw new Error('Nenhuma configuraÃ§Ã£o de cashback encontrada');
    }

    return current;
}

export async function updateCashbackSettings(
    updates: Partial<CashbackSettings>
): Promise<CashbackSettings> {
    // Buscar o ID atual primeiro para evitar o erro 403 (RLS pode falhar com neq em updates nulos)
    const current = await getCashbackSettings();

    if (!current?.id) {
        throw new Error('Nenhuma configuraÃ§Ã£o de cashback encontrada para atualizar');
    }

    return vpsClient.patch<CashbackSettings>(`/table-data/cashback_settings/${current.id}`, {
        ...updates,
        updated_at: new Date().toISOString(),
    });
}

// ============================================================
// SALDO
// ============================================================

export async function getCoinBalance(customerId: string): Promise<CoinBalance | null> {
    const balances = await loadCoinBalances();
    return balances.find(balance => balance.customer_id === customerId) || null;
}

export async function getOrCreateBalance(customerId: string): Promise<CoinBalance> {
    const existing = await getCoinBalance(customerId);
    if (existing) return existing;

    return vpsClient.post<CoinBalance>('/table-data/coin_balances', {
        customer_id: customerId,
        balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
    });
}

async function patchBalance(balance: CoinBalance, updates: Partial<CoinBalance>): Promise<CoinBalance> {
    return vpsClient.patch<CoinBalance>(`/table-data/coin_balances/${balance.id}`, {
        ...updates,
        updated_at: new Date().toISOString(),
    });
}

export async function addCoins(
    customerId: string,
    amount: number,
    type: CoinTransactionType,
    description: string,
    referenceId?: string | null,
    referenceType?: CoinReferenceType | null,
    status: CoinTransaction['status'] = 'completed'
): Promise<CoinTransaction> {
    if (amount <= 0) throw new Error('Quantidade de moedas deve ser positiva');
    const now = new Date().toISOString();

    if (status === 'completed') {
        const balance = await getOrCreateBalance(customerId);
        await patchBalance(balance, {
            balance: Number(balance.balance || 0) + amount,
            lifetime_earned: Number(balance.lifetime_earned || 0) + amount,
        });
    }

    return vpsClient.post<CoinTransaction>('/table-data/coin_transactions', {
        id: createLocalId(),
        customer_id: customerId,
        amount,
        type,
        status,
        description,
        reference_id: referenceId ?? null,
        reference_type: referenceType ?? null,
        created_at: now,
    });
}

export async function spendCoins(
    customerId: string,
    amount: number,
    type: CoinTransactionType,
    description: string,
    referenceId?: string | null,
    referenceType?: CoinReferenceType | null
): Promise<CoinTransaction> {
    if (amount <= 0) throw new Error('Quantidade de moedas deve ser positiva');
    const balance = await getOrCreateBalance(customerId);
    if (Number(balance.balance || 0) < amount) throw new Error('Saldo insuficiente');

    await patchBalance(balance, {
        balance: Number(balance.balance || 0) - amount,
        lifetime_spent: Number(balance.lifetime_spent || 0) + amount,
    });

    return vpsClient.post<CoinTransaction>('/table-data/coin_transactions', {
        id: createLocalId(),
        customer_id: customerId,
        amount: -amount,
        type,
        status: 'completed',
        description,
        reference_id: referenceId ?? null,
        reference_type: referenceType ?? null,
        created_at: new Date().toISOString(),
    });
}

export async function listCoinBalances(): Promise<CoinBalance[]> {
    return loadCoinBalances();
}

// ============================================================
// HISTÃ“RICO DE TRANSAÃ‡Ã•ES
// ============================================================

export async function getCoinTransactions(
    customerId: string,
    limit = 20
): Promise<CoinTransaction[]> {
    return sortTransactionsNewestFirst(
        (await loadCoinTransactions()).filter(transaction => transaction.customer_id === customerId)
    ).slice(0, limit);
}

// Admin: todas as transaÃ§Ãµes com filtros
export async function listAllTransactions(filters?: {
    type?: CoinTransactionType;
    from?: string;
    to?: string;
    limit?: number;
}): Promise<CoinTransaction[]> {
    let rows = await loadCoinTransactions();

    if (filters?.type) rows = rows.filter(transaction => transaction.type === filters.type);
    if (filters?.from) rows = rows.filter(transaction => transaction.created_at >= filters.from!);
    if (filters?.to) rows = rows.filter(transaction => transaction.created_at <= filters.to!);

    const limited = sortTransactionsNewestFirst(rows).slice(0, filters?.limit ?? 100);
    const customers = await loadTableRows<CustomerSummary>('customers');
    const customerNameById = new Map(customers.map(customer => [customer.id, customer.name || null]));

    return limited.map(transaction => ({
        ...transaction,
        customers: { name: customerNameById.get(transaction.customer_id) || null },
    } as CoinTransaction));
}

export async function getCoinsEarnedForReference(
    customerId: string,
    referenceId: string,
    type: CoinTransactionType = 'earn_purchase'
): Promise<number> {
    const transaction = sortTransactionsNewestFirst(
        (await loadCoinTransactions()).filter(row =>
            row.customer_id === customerId &&
            row.reference_id === referenceId &&
            row.type === type
        )
    )[0];

    return transaction?.amount ?? 0;
}

// ============================================================
// ACÃšMULO â€” APÃ“S COMPRA
// ============================================================

/**
 * Acumula moedas para um cliente apÃ³s uma compra.
 *
 * âš ï¸ REGRA CRÃTICA: `finalPaidBrl` deve ser o valor FINAL PAGO pelo cliente,
 * ou seja, APÃ“S subtrair cupom de desconto e moedas resgatadas.
 * Nunca passar o valor bruto do pedido â€” isso geraria duplicidade de desconto.
 *
 * Exemplo correto:
 *   Pedido R$ 100 - cupom R$ 20 - moedas R$ 5 = R$ 75 pago â†’ cashback sobre R$ 75
 */
export async function earnCoinsForPurchase(
    customerId: string,
    finalPaidBrl: number,  // Valor FINAL pago â€” depois de todos os descontos
    saleId: string
): Promise<number> {
    const settings = await getCashbackSettings();

    if (!settings.active) return 0;
    if (finalPaidBrl < 0.01) return 0; // Compra zerada por descontos nÃ£o gera cashback
    if (finalPaidBrl < settings.min_purchase_for_coins) return 0;

    const coinsEarned = Math.floor(finalPaidBrl * settings.coins_per_real);
    if (coinsEarned <= 0) return 0;

    await addCoins(
        customerId,
        coinsEarned,
        'earn_purchase',
        `Compra aprovada - R$ ${finalPaidBrl.toFixed(2).replace('.', ',')}`,
        saleId,
        'sale'
    );
    return coinsEarned;
}

// ============================================================
// ACÃšMULO â€” AVALIAÃ‡ÃƒO DE PRODUTO
// ============================================================
export async function earnCoinsForReview(
    customerId: string,
    reviewId: string
): Promise<number> {
    const settings = await getCashbackSettings();

    if (!settings.active || !settings.review_coins || settings.review_coins <= 0) return 0;

    const coinsEarned = settings.review_coins;

    await addCoins(
        customerId,
        coinsEarned,
        'earn_review',
        'Avaliacao de produto',
        reviewId,
        'review'
    );
    return coinsEarned;
}

// EmissÃ£o de moedas pendentes (para novas compras online aguardando pagamento/aprovaÃ§Ã£o)
export async function addPendingCoinsForPurchase(
    customerId: string,
    finalPaidBrl: number,
    saleId: string
): Promise<void> {
    const settings = await getCashbackSettings();
    if (!settings.active || finalPaidBrl < settings.min_purchase_for_coins) return;

    const coinsToEarn = Math.floor(finalPaidBrl * settings.coins_per_real);
    if (coinsToEarn <= 0) return;

    await addCoins(
        customerId,
        coinsToEarn,
        'earn_purchase',
        `Moedas pendentes da compra #${saleId.slice(0, 8)}`,
        saleId,
        'sale',
        'pending'
    );
}

// Confirma moedas pendentes
export async function confirmPendingCoins(saleId: string): Promise<void> {
    const pending = (await loadCoinTransactions()).filter(transaction =>
        transaction.reference_id === saleId && transaction.status === 'pending'
    );

    for (const transaction of pending) {
        const amount = Number(transaction.amount || 0);
        if (amount <= 0) continue;

        const balance = await getOrCreateBalance(transaction.customer_id);
        await patchBalance(balance, {
            balance: Number(balance.balance || 0) + amount,
            lifetime_earned: Number(balance.lifetime_earned || 0) + amount,
        });
        await vpsClient.patch<CoinTransaction>(`/table-data/coin_transactions/${transaction.id}`, {
            status: 'completed',
        });
    }
}

// Cancela moedas pendentes
export async function cancelPendingCoins(saleId: string): Promise<void> {
    const pending = (await loadCoinTransactions()).filter(transaction =>
        transaction.reference_id === saleId && transaction.status === 'pending'
    );

    for (const transaction of pending) {
        await vpsClient.patch<CoinTransaction>(`/table-data/coin_transactions/${transaction.id}`, {
            status: 'cancelled',
        });
    }
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
        return { valid: false, error: `Saldo mÃ­nimo para resgate: ${settings.min_coins_to_redeem} moedas`, coins_to_use: 0, discount_brl: 0, final_price: orderValueBrl };
    }
    if (coinsToUse > balance.balance) {
        return { valid: false, error: 'Saldo insuficiente', coins_to_use: 0, discount_brl: 0, final_price: orderValueBrl };
    }

    // Cap: desconto mÃ¡ximo = max_redeem_percent% do pedido
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
    await spendCoins(
        customerId,
        coinsToUse,
        'spend_discount',
        description,
        referenceId ?? null,
        referenceType
    );
}

// ============================================================
// ESTORNO (CANCELAMENTO)
// ============================================================

export async function refundCoinsOnCancel(
    customerId: string,
    coinsToRefund: number,
    saleId: string
): Promise<void> {
    await addCoins(
        customerId,
        coinsToRefund,
        'refund_cancel',
        'Estorno de moedas por cancelamento',
        saleId,
        'sale'
    );
}

export async function cancelReferralReward(referenceId: string): Promise<void> {
    const rewards = (await loadCoinTransactions()).filter(transaction =>
        transaction.reference_id === referenceId &&
        transaction.type === 'earn_referral' &&
        transaction.status === 'completed' &&
        Number(transaction.amount || 0) > 0
    );

    for (const reward of rewards) {
        try {
            await spendCoins(
                reward.customer_id,
                Number(reward.amount || 0),
                'refund_cancel',
                'Estorno de moedas de indicacao',
                referenceId,
                'sale'
            );
        } catch (error) {
            console.error(`Erro ao estornar moedas de indicacao para o pedido ${referenceId}:`, error);
        }
    }
}

// ============================================================
// AJUSTE MANUAL (ADMIN)
// ============================================================

export async function adminAdjustCoins(
    customerId: string,
    amount: number, // positivo = adicionar, negativo = remover
    reason: string
): Promise<void> {
    if (amount > 0) {
        await addCoins(customerId, amount, 'admin_adjust', reason, null, 'admin');
        return;
    }

    await spendCoins(customerId, Math.abs(amount), 'admin_adjust', reason, null, 'admin');
}

// ============================================================
// VALIDAÃ‡ÃƒO DE INDICAÃ‡ÃƒO
// ============================================================

export async function validateReferralCode(
    code: string,
    currentCustomerId?: string
): Promise<{ valid: boolean; error?: string; referrerName?: string }> {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return { valid: false, error: 'CÃ³digo vazio.' };

    const customers = await loadTableRows<CustomerSummary>('customers');

    // Check if it's the user's own code
    if (currentCustomerId) {
        const currentCustomer = customers.find(customer => customer.id === currentCustomerId);

        if (currentCustomer?.referral_code?.toUpperCase() === normalizedCode) {
            return { valid: false, error: 'VocÃª nÃ£o pode usar seu prÃ³prio cÃ³digo de indicaÃ§Ã£o.' };
        }
    }

    const referrer = customers.find(customer => customer.referral_code?.toUpperCase() === normalizedCode);

    if (!referrer) {
        return { valid: false, error: 'CÃ³digo de indicaÃ§Ã£o invÃ¡lido ou nÃ£o encontrado.' };
    }

    return { valid: true, referrerName: referrer.name };
}

export async function processReferralReward(input: {
    referralCode: string;
    buyerId: string;
    purchaseValue: number;
    referenceId: string;
    referenceType: Extract<CoinReferenceType, 'sale' | 'order'>;
    buyerName?: string | null;
}): Promise<{ success: boolean; coins_awarded?: number; error?: string }> {
    const settings = await getCashbackSettings();
    if (!settings.active) return { success: false, error: 'Sistema de moedas inativo' };

    const normalizedCode = input.referralCode.trim().toUpperCase();
    if (!normalizedCode) return { success: false, error: 'Codigo de indicacao vazio' };

    const customers = await loadTableRows<CustomerSummary>('customers');
    const referrer = customers.find(customer => customer.referral_code?.toUpperCase() === normalizedCode);
    if (!referrer) return { success: false, error: 'Codigo de indicacao invalido' };
    if (referrer.id === input.buyerId) return { success: false, error: 'Autoindicacao ignorada' };

    const alreadyRewarded = (await loadCoinTransactions()).some(transaction =>
        transaction.reference_id === input.referenceId &&
        transaction.reference_type === input.referenceType &&
        transaction.type === 'earn_referral' &&
        transaction.status !== 'cancelled'
    );
    if (alreadyRewarded) return { success: false, error: 'Indicacao ja processada' };

    const coins = Math.floor(Math.max(0, input.purchaseValue) * Number(settings.referral_coins_per_real || 0));
    if (coins <= 0) return { success: false, error: 'Valor insuficiente para gerar recompensa' };

    await addCoins(
        referrer.id,
        coins,
        'earn_referral',
        `Indicacao de ${input.buyerName || 'cliente'}`,
        input.referenceId,
        input.referenceType
    );

    return { success: true, coins_awarded: coins };
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

