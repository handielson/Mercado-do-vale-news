import { supabase } from './supabase';

export interface Coupon {
    id: string;
    code: string;
    description: string | null;
    type: 'percent' | 'fixed';
    value: number;
    min_order: number;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    active: boolean;
    target_type: 'all' | 'varejo' | 'atacado' | 'revenda' | 'ADMIN';
    created_at: string;
}

export interface CouponValidation {
    valid: boolean;
    error?: string;
    coupon?: Coupon;
    discount?: number;    // valor monetário em R$
    finalPrice?: number;  // totalPrice - discount
}

/**
 * Validates a coupon code against the given total and customer type.
 * Returns the computed discount amount in R$.
 */
export async function validateCoupon(
    code: string,
    totalPrice: number,
    customerType?: string
): Promise<CouponValidation> {
    if (!code.trim()) return { valid: false, error: 'Informe o código do cupom' };

    const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('active', true)
        .ilike('code', code.trim())
        .single();

    if (error || !coupon) {
        return { valid: false, error: 'Cupom inválido ou não encontrado' };
    }

    // Check target type
    if (coupon.target_type !== 'all' && coupon.target_type !== customerType) {
        return { valid: false, error: 'Cupom não disponível para o seu tipo de cliente' };
    }

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, error: 'Este cupom está expirado' };
    }

    // Check usage limit
    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
        return { valid: false, error: 'Este cupom atingiu o limite de usos' };
    }

    // Check minimum order
    if (totalPrice < coupon.min_order) {
        return {
            valid: false,
            error: `Pedido mínimo de R$ ${coupon.min_order.toFixed(2).replace('.', ',')} para este cupom`,
        };
    }

    // Calculate discount (capped at totalPrice)
    const raw = coupon.type === 'percent'
        ? (totalPrice * coupon.value) / 100
        : coupon.value;

    const discount = Math.min(raw, totalPrice);
    const finalPrice = totalPrice - discount;

    return { valid: true, coupon, discount, finalPrice };
}

/**
 * Increments the uses_count for a coupon after a successful purchase.
 */
export async function applyCoupon(couponId: string): Promise<void> {
    await supabase.rpc('increment_coupon_uses', { coupon_id: couponId });
}

// Admin CRUD
export async function listCoupons(): Promise<Coupon[]> {
    const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'uses_count' | 'created_at'>): Promise<Coupon> {
    const { data, error } = await supabase
        .from('coupons')
        .insert({ ...coupon, code: coupon.code.toUpperCase() })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateCoupon(id: string, updates: Partial<Omit<Coupon, 'id' | 'created_at'>>): Promise<Coupon> {
    const payload = updates.code
        ? { ...updates, code: updates.code.toUpperCase() }
        : updates;

    const { data, error } = await supabase
        .from('coupons')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCoupon(id: string): Promise<void> {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
}
