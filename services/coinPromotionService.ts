import { supabase } from './supabase';
import type { CoinTransactionType } from '../types/cashback';

// ============================================================
// TIPOS
// ============================================================

export interface CoinPromotion {
    id: string;
    name: string;
    description: string | null;
    product_id: string | null;
    category_id: string | null;
    min_purchase: number;
    bonus_coins: number;
    starts_at: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    active: boolean;
    created_at: string;
    // JOIN opcionais
    products?: { name: string } | null;
    categories?: { name: string } | null;
}

export interface CoinPromoMatch {
    promo: CoinPromotion;
    bonus: number;
}

// ============================================================
// CRUD ADMIN
// ============================================================

export async function listCoinPromotions(): Promise<CoinPromotion[]> {
    const { data, error } = await supabase
        .from('coin_promotions')
        .select('*, products(name), categories(name)')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as CoinPromotion[];
}

export async function createCoinPromotion(
    promo: Omit<CoinPromotion, 'id' | 'uses_count' | 'created_at' | 'products' | 'categories'>
): Promise<CoinPromotion> {
    const { data, error } = await supabase
        .from('coin_promotions')
        .insert(promo)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data as CoinPromotion;
}

export async function updateCoinPromotion(
    id: string,
    updates: Partial<CoinPromotion>
): Promise<void> {
    const { error } = await supabase
        .from('coin_promotions')
        .update(updates)
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function deleteCoinPromotion(id: string): Promise<void> {
    const { error } = await supabase
        .from('coin_promotions')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function toggleCoinPromotion(id: string, active: boolean): Promise<void> {
    await updateCoinPromotion(id, { active });
}

// ============================================================
// LÓGICA DE APLICAÇÃO
// ============================================================

/**
 * Verifica quais promoções ativas se aplicam a uma compra.
 * Retorna lista de promoções correspondentes com bônus calculado.
 *
 * @param productIds - IDs dos produtos comprados
 * @param categoryIds - IDs das categorias dos produtos comprados
 * @param purchaseTotal - Valor total final pago em R$
 */
export async function getApplicablePromotions(
    productIds: string[],
    categoryIds: string[],
    purchaseTotal: number
): Promise<CoinPromoMatch[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('coin_promotions')
        .select('*')
        .eq('active', true)
        .lte('starts_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error || !data) return [];

    const promos = data as CoinPromotion[];
    const matches: CoinPromoMatch[] = [];

    for (const promo of promos) {
        // Verificar limite de usos
        if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) continue;

        // Verificar se bate com produto OU categoria OU valor mínimo
        const productMatch = promo.product_id && productIds.includes(promo.product_id);
        const categoryMatch = promo.category_id && categoryIds.includes(promo.category_id);
        const valueMatch = !promo.product_id && !promo.category_id && purchaseTotal >= promo.min_purchase;

        if (productMatch || categoryMatch || valueMatch) {
            matches.push({ promo, bonus: promo.bonus_coins });
        }
    }

    return matches;
}

/**
 * Aplica as promoções correspondentes: credita bônus e incrementa contadores.
 */
export async function applyPromotions(
    customerId: string,
    matches: CoinPromoMatch[],
    saleId: string
): Promise<number> {
    let totalBonus = 0;

    for (const { promo, bonus } of matches) {
        // Creditar moedas
        const { error: coinsError } = await supabase.rpc('add_coins', {
            p_customer_id: customerId,
            p_amount: bonus,
            p_type: 'earn_manual' as CoinTransactionType,
            p_description: `Promoção: ${promo.name}`,
            p_reference_id: saleId,
            p_reference_type: 'sale',
        });

        if (coinsError) {
            console.error(`[Promoção] Erro ao creditar bônus "${promo.name}":`, coinsError);
            continue;
        }

        // Incrementar contador de usos
        await supabase.rpc('increment_coin_promo_uses', { promo_id: promo.id });
        totalBonus += bonus;
    }

    return totalBonus;
}
