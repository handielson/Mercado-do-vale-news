/**
 * Sale Calculations
 * Utility functions for calculating sale totals, discounts, and profit
 */

import { SaleItem, PaymentMethod } from '../types/sale';

/**
 * Calculate total for a single item
 */
export const calculateItemTotal = (item: SaleItem): number => {
    const subtotal = item.unit_price * item.quantity;

    if (item.is_gift) {
        // Brinde: desconto integral automático
        return 0;
    }

    const discountTotal = item.discount * item.quantity;
    return subtotal - discountTotal;
};

/**
 * Calculate subtotal for a single item (without discount)
 */
export const calculateItemSubtotal = (item: SaleItem): number => {
    return item.unit_price * item.quantity;
};

/**
 * Calculate discount for a single item
 */
export const calculateItemDiscount = (item: SaleItem): number => {
    if (item.is_gift) {
        // Brinde: desconto integral
        return item.unit_price * item.quantity;
    }

    return item.discount * item.quantity;
};

/**
 * Calculate cost for a single item
 */
export const calculateItemCost = (item: SaleItem): number => {
    return item.unit_cost * item.quantity;
};

/**
 * Calculate all totals for a sale
 */
export const calculateSaleTotals = (items: SaleItem[]) => {
    const subtotal = items.reduce((sum, item) =>
        sum + calculateItemSubtotal(item), 0
    );

    const discount_total = items.reduce((sum, item) =>
        sum + calculateItemDiscount(item), 0
    );

    const total = subtotal - discount_total;

    const cost_total = items.reduce((sum, item) =>
        sum + calculateItemCost(item), 0
    );

    const profit = total - cost_total;

    return {
        subtotal,
        discount_total,
        total,
        cost_total,
        profit
    };
};

/**
 * Calculate total paid from payment methods
 */
export const calculateTotalPaid = (payments: PaymentMethod[]): number => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
};

/**
 * Calculate change (troco) for money payments
 */
export const calculateChange = (total: number, payments: PaymentMethod[]): number => {
    const totalPaid = calculateTotalPaid(payments);
    const change = totalPaid - total;
    return change > 0 ? change : 0;
};

/**
 * Calculate remaining amount to be paid
 */
export const calculateRemaining = (total: number, payments: PaymentMethod[]): number => {
    const totalPaid = calculateTotalPaid(payments);
    const remaining = total - totalPaid;
    return remaining > 0 ? remaining : 0;
};

/**
 * Check if payment is complete
 */
export const isPaymentComplete = (total: number, payments: PaymentMethod[]): boolean => {
    return calculateTotalPaid(payments) >= total;
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (profit: number, total: number): number => {
    if (total === 0) return 0;
    return (profit / total) * 100;
};

/**
 * Format currency from centavos to BRL string
 */
export const formatCurrency = (centavos: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(centavos / 100);
};

/**
 * Get payment method label in Portuguese
 */
export const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
        money: 'Dinheiro',
        credit: 'Cartão de Crédito',
        debit: 'Cartão de Débito',
        pix: 'PIX'
    };
    return labels[method] || method;
};

/**
 * Get payment method icon
 */
export const getPaymentMethodIcon = (method: string): string => {
    const icons: Record<string, string> = {
        money: '💵',
        credit: '💳',
        debit: '💳',
        pix: '📱'
    };
    return icons[method] || '💰';
};
