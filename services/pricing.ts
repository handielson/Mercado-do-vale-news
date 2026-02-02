import { paymentFeesService } from './payment-fees';
import { PaymentFee } from '../types/payment-fees';
import {
    getPriceForPayment,
    calculateInstallmentValue,
    formatPrice
} from '../utils/pricing';

export interface ClientTypePrices {
    pix: number;
    debit: number;
    credit: CreditPrice[];
}

export interface CreditPrice {
    installments: number;
    totalPrice: number;
    installmentValue: number;
    fee: number;
}

export interface ProductPrices {
    retail: ClientTypePrices;
    reseller: ClientTypePrices;
    wholesale: ClientTypePrices;
}

/**
 * Calculate prices for a specific client type
 */
function calculatePricesForClientType(
    basePrice: number,
    fees: PaymentFee[]
): ClientTypePrices {
    return {
        pix: getPriceForPayment(basePrice, 'pix', 1, fees),
        debit: getPriceForPayment(basePrice, 'debit', 1, fees),
        credit: Array.from({ length: 18 }, (_, i) => {
            const installments = i + 1;
            const totalPrice = getPriceForPayment(basePrice, 'credit', installments, fees);
            const fee = fees.find(f => f.payment_method === 'credit' && f.installments === installments);

            return {
                installments,
                totalPrice,
                installmentValue: calculateInstallmentValue(totalPrice, installments),
                fee: fee?.applied_fee || 0
            };
        })
    };
}

export const pricingService = {
    /**
     * Get all prices for a product based on client type
     * @param retailPrice - Retail margin price in cents
     * @param resellerPrice - Reseller margin price in cents
     * @param wholesalePrice - Wholesale margin price in cents
     * @returns Object with prices for all client types and payment methods
     */
    async getProductPrices(
        retailPrice: number,
        resellerPrice: number,
        wholesalePrice: number
    ): Promise<ProductPrices> {
        const fees = await paymentFeesService.list();

        return {
            retail: calculatePricesForClientType(retailPrice, fees),
            reseller: calculatePricesForClientType(resellerPrice, fees),
            wholesale: calculatePricesForClientType(wholesalePrice, fees)
        };
    },

    /**
     * Get best price (PIX) for a specific client type
     * @param basePrice - Base margin price in cents
     * @returns PIX price in cents
     */
    async getBestPrice(basePrice: number): Promise<number> {
        const fees = await paymentFeesService.list();
        const pixFee = fees.find(f => f.payment_method === 'pix');

        if (pixFee) {
            return getPriceForPayment(basePrice, 'pix', 1, fees);
        }

        return basePrice; // Fallback
    },

    /**
     * Format price for display
     */
    formatPrice
};
