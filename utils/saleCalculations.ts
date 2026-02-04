/**
 * Sale Calculations
 * Utility functions for calculating sale totals, discounts, profit, and payment fees
 */

import { SaleItem, PaymentMethod, PaymentMethodType, DeliveryType } from '../types/sale';
import { PaymentFee } from '../types/payment-fees';

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
 * Calculate payment fee based on method, installments, and payment fees table
 */
export const calculatePaymentFee = (
    amount: number, // em centavos
    method: PaymentMethodType,
    installments: number = 1,
    paymentFees: PaymentFee[]
): { fee_percentage: number; fee_amount: number; total_with_fee: number } => {
    // Pagamentos à vista não têm taxa
    if (method === 'money' || method === 'pix' || method === 'debit') {
        return {
            fee_percentage: 0,
            fee_amount: 0,
            total_with_fee: amount
        };
    }

    // Crédito à vista (1x) também não tem taxa
    if (method === 'credit' && installments === 1) {
        return {
            fee_percentage: 0,
            fee_amount: 0,
            total_with_fee: amount
        };
    }

    // Buscar taxa na tabela
    const feeConfig = paymentFees.find(
        f => f.payment_method === method && f.installments === installments
    );

    if (!feeConfig) {
        console.warn(`Taxa não configurada para ${method} ${installments}x`);
        return {
            fee_percentage: 0,
            fee_amount: 0,
            total_with_fee: amount
        };
    }

    const fee_percentage = feeConfig.applied_fee;
    const fee_amount = Math.round(amount * (fee_percentage / 100));
    const total_with_fee = amount + fee_amount;

    return { fee_percentage, fee_amount, total_with_fee };
};

/**
 * Calculate total paid from payment methods (including fees)
 */
export const calculateTotalPaid = (payments: PaymentMethod[]): number => {
    return payments.reduce((sum, payment) => {
        // Usar total_with_fee se existir, senão usar amount
        const paymentValue = payment.total_with_fee ?? payment.amount ?? 0;
        return sum + paymentValue;
    }, 0);
};

/**
 * Calculate delivery discount based on delivery type
 */
export const calculateDeliveryDiscount = (
    deliveryType: DeliveryType | undefined,
    deliveryCostStore: number
): number => {
    if (!deliveryType || deliveryType === 'store_pickup') {
        return 0;
    }

    // Entrega pela loja: desconto integral (R$ 30)
    if (deliveryType === 'store_delivery') {
        return deliveryCostStore;
    }

    // Entrega híbrida: desconto parcial (parte da loja)
    if (deliveryType === 'hybrid_delivery') {
        return deliveryCostStore;
    }

    return 0;
};

/**
 * Calculate total delivery cost (for customer)
 */
export const calculateDeliveryTotal = (
    deliveryType: DeliveryType | undefined,
    deliveryCostCustomer: number
): number => {
    if (!deliveryType || deliveryType === 'store_pickup') {
        return 0;
    }

    return deliveryCostCustomer;
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
export const getPaymentMethodLabel = (method: string, installments?: number): string => {
    const labels: Record<string, string> = {
        money: 'Dinheiro',
        credit: 'Cartão de Crédito',
        debit: 'Cartão de Débito',
        pix: 'PIX'
    };

    const baseLabel = labels[method] || method;

    if (method === 'credit' && installments && installments > 1) {
        return `${baseLabel} ${installments}x`;
    }

    return baseLabel;
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

/**
 * Get delivery type label in Portuguese
 */
export const getDeliveryTypeLabel = (deliveryType: DeliveryType | undefined): string => {
    if (!deliveryType) return 'Não definido';

    const labels: Record<DeliveryType, string> = {
        store_pickup: 'Retirada na Loja',
        store_delivery: 'Entrega pela Loja',
        hybrid_delivery: 'Entrega Híbrida'
    };

    return labels[deliveryType];
};
