import { vpsClient } from './vpsClient';

export interface Coupon {
    id: string;
    code: string;
    description?: string | null;
    type: 'percent' | 'fixed';
    value: number;
    min_order: number;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    active: boolean;
    target_type: 'all' | 'varejo' | 'atacado' | 'revenda' | 'ADMIN';
    created_at?: string;
}

export interface CouponValidation {
    valid: boolean;
    error?: string;
    coupon?: Coupon;
    discount?: number;
    finalPrice?: number;
}

export async function validateCoupon(
    code: string,
    totalPrice: number,
    customerType?: string
): Promise<CouponValidation> {
    if (!code.trim()) return { valid: false, error: 'Informe o código do cupom' };

    let coupon: Coupon;
    try {
        coupon = await vpsClient.get<Coupon>(`/coupons/validate/${encodeURIComponent(code.trim().toUpperCase())}`);
    } catch {
        return { valid: false, error: 'Cupom inválido ou não encontrado' };
    }

    if (coupon.target_type !== 'all' && coupon.target_type !== customerType) {
        return { valid: false, error: 'Cupom não disponível para o seu tipo de cliente' };
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return { valid: false, error: 'Este cupom está expirado' };
    }

    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
        return { valid: false, error: 'Este cupom atingiu o limite de usos' };
    }

    if (totalPrice < coupon.min_order) {
        return {
            valid: false,
            error: `Pedido mínimo de R$ ${coupon.min_order.toFixed(2).replace('.', ',')} para este cupom`,
        };
    }

    const raw = coupon.type === 'percent'
        ? (totalPrice * coupon.value) / 100
        : coupon.value;

    const discount = Math.min(raw, totalPrice);
    const finalPrice = totalPrice - discount;

    return { valid: true, coupon, discount, finalPrice };
}

export async function applyCoupon(couponCode: string): Promise<void> {
    await vpsClient.post<{ ok: boolean }>(`/coupons/${encodeURIComponent(couponCode)}/use`, {});
}

export async function listCoupons(): Promise<Coupon[]> {
    return vpsClient.get<Coupon[]>('/coupons');
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'uses_count' | 'created_at'>): Promise<Coupon> {
    const { id } = await vpsClient.post<{ ok: boolean; id: string }>('/coupons', coupon);
    return { ...coupon, id, uses_count: 0 };
}

export async function updateCoupon(id: string, updates: Partial<Omit<Coupon, 'id' | 'created_at'>>): Promise<Coupon> {
    await vpsClient.patch<{ ok: boolean }>(`/coupons/${id}`, updates);
    const all = await listCoupons();
    return all.find(c => c.id === id) as Coupon;
}

export async function deleteCoupon(id: string): Promise<void> {
    await vpsClient.delete(`/coupons/${id}`);
}
