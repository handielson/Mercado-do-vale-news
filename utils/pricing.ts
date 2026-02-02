import { PaymentFee } from '../types/payment-fees';

/**
 * Calculate final price with payment fee
 * @param basePrice - Margin price (cost + profit) in cents
 * @param feePercent - Payment fee percentage
 * @returns Final price in cents
 */
export function calculateFinalPrice(
    basePrice: number,
    feePercent: number
): number {
    return Math.round(basePrice * (1 + feePercent / 100));
}

/**
 * Get price for specific payment method
 * @param basePrice - Base margin price in cents
 * @param paymentMethod - Payment method type
 * @param installments - Number of installments
 * @param fees - Array of payment fees
 * @returns Final price in cents
 */
export function getPriceForPayment(
    basePrice: number,
    paymentMethod: 'debit' | 'pix' | 'credit',
    installments: number,
    fees: PaymentFee[]
): number {
    const fee = fees.find(
        f => f.payment_method === paymentMethod && f.installments === installments
    );

    if (!fee) return basePrice;

    return calculateFinalPrice(basePrice, fee.applied_fee);
}

/**
 * Format price for display
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "R$ 1.234,56")
 */
export function formatPrice(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(cents / 100);
}

/**
 * Calculate installment value
 * @param totalPrice - Total price in cents
 * @param installments - Number of installments
 * @returns Installment value in cents
 */
export function calculateInstallmentValue(
    totalPrice: number,
    installments: number
): number {
    return Math.round(totalPrice / installments);
}

/**
 * Get display label for payment method
 * @param method - Payment method
 * @param installments - Number of installments
 * @returns Display label
 */
export function getPaymentLabel(
    method: string,
    installments: number
): string {
    if (method === 'pix') return 'PIX';
    if (method === 'debit') return 'Débito';
    return `${installments}x`;
}
