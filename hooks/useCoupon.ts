import { useState } from 'react';
import { validateCoupon, applyCoupon, type Coupon } from '../services/couponService';

interface UseCouponReturn {
    code: string;
    setCode: (v: string) => void;
    isLoading: boolean;
    error: string | null;
    discount: number;
    finalPrice: number;
    appliedCoupon: Coupon | null;
    apply: () => Promise<void>;
    confirm: () => Promise<void>; // call after successful purchase
    clear: () => void;
}

/**
 * Reusable hook for coupon validation state.
 * @param totalPrice  Current cart/order total in R$.
 * @param customerType  Customer type from auth context ('varejo', 'atacado', etc.)
 */
export function useCoupon(totalPrice: number, customerType?: string): UseCouponReturn {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discount, setDiscount] = useState(0);
    const [finalPrice, setFinalPrice] = useState(totalPrice);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

    const apply = async () => {
        if (!code.trim()) return;
        setIsLoading(true);
        setError(null);

        const result = await validateCoupon(code, totalPrice, customerType);

        if (!result.valid || !result.coupon) {
            setError(result.error ?? 'Cupom inválido');
            setDiscount(0);
            setFinalPrice(totalPrice);
            setAppliedCoupon(null);
        } else {
            setDiscount(result.discount!);
            setFinalPrice(result.finalPrice!);
            setAppliedCoupon(result.coupon);
        }

        setIsLoading(false);
    };

    const confirm = async () => {
        if (appliedCoupon) {
            await applyCoupon(appliedCoupon.id);
        }
    };

    const clear = () => {
        setCode('');
        setError(null);
        setDiscount(0);
        setFinalPrice(totalPrice);
        setAppliedCoupon(null);
    };

    return { code, setCode, isLoading, error, discount, finalPrice, appliedCoupon, apply, confirm, clear };
}
