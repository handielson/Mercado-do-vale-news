/**
 * PRICING INTEGRATION - USAGE EXAMPLES
 * 
 * This file demonstrates how to use the new pricing utilities
 * to calculate final prices with payment fees.
 */

import { pricingService } from '../services/pricing';
import { formatPrice } from '../utils/pricing';

// ============================================
// EXAMPLE 1: Get All Prices for a Product
// ============================================

async function example1_getAllPrices() {
    // Product margins (in cents)
    const retailMargin = 429900;    // R$ 4.299,00
    const resellerMargin = 399900;  // R$ 3.999,00
    const wholesaleMargin = 379900; // R$ 3.799,00

    // Get all prices with payment fees
    const prices = await pricingService.getProductPrices(
        retailMargin,
        resellerMargin,
        wholesaleMargin
    );

    console.log('=== RETAIL PRICES ===');
    console.log('PIX:', formatPrice(prices.retail.pix));
    console.log('Débito:', formatPrice(prices.retail.debit));
    console.log('1x:', formatPrice(prices.retail.credit[0].totalPrice));
    console.log('12x:', formatPrice(prices.retail.credit[11].totalPrice),
        `(12x de ${formatPrice(prices.retail.credit[11].installmentValue)})`);

    // Expected output:
    // PIX: R$ 4.299,00 (0% fee)
    // Débito: R$ 4.341,99 (1% fee)
    // 1x: R$ 4.599,93 (7% fee)
    // 12x: R$ 5.029,83 (12x de R$ 419,15) (17% fee)
}

// ============================================
// EXAMPLE 2: Get Best Price (PIX)
// ============================================

async function example2_getBestPrice() {
    const retailMargin = 429900; // R$ 4.299,00

    const bestPrice = await pricingService.getBestPrice(retailMargin);

    console.log('Melhor preço (PIX):', formatPrice(bestPrice));
    // Expected: R$ 4.299,00
}

// ============================================
// EXAMPLE 3: Display in Product Card
// ============================================

interface ProductCardExampleProps {
    product: {
        name: string;
        price_retail: number;
        price_reseller: number;
        price_wholesale: number;
    };
    clientType: 'retail' | 'reseller' | 'wholesale';
    paymentMethod: 'pix' | 'debit' | 'credit';
    installments: number;
}

async function example3_productCard(props: ProductCardExampleProps) {
    const { product, clientType, paymentMethod, installments } = props;

    // Get all prices
    const prices = await pricingService.getProductPrices(
        product.price_retail,
        product.price_reseller,
        product.price_wholesale
    );

    // Select price based on client type and payment method
    let finalPrice: number;
    let installmentValue: number | null = null;

    if (paymentMethod === 'pix') {
        finalPrice = prices[clientType].pix;
    } else if (paymentMethod === 'debit') {
        finalPrice = prices[clientType].debit;
    } else {
        const creditOption = prices[clientType].credit[installments - 1];
        finalPrice = creditOption.totalPrice;
        installmentValue = creditOption.installmentValue;
    }

    // Display
    console.log(`${product.name}:`);
    console.log(`Preço: ${formatPrice(finalPrice)}`);
    if (installmentValue) {
        console.log(`Parcelas: ${installments}x de ${formatPrice(installmentValue)}`);
    }
}

// Example usage:
example3_productCard({
    product: {
        name: 'iPhone 13',
        price_retail: 429900,
        price_reseller: 399900,
        price_wholesale: 379900
    },
    clientType: 'retail',
    paymentMethod: 'credit',
    installments: 12
});
// Expected output:
// iPhone 13:
// Preço: R$ 5.029,83
// Parcelas: 12x de R$ 419,15

// ============================================
// EXAMPLE 4: Price Comparison Table
// ============================================

async function example4_priceTable() {
    const retailMargin = 429900; // R$ 4.299,00

    const prices = await pricingService.getProductPrices(
        retailMargin,
        retailMargin,
        retailMargin
    );

    console.log('=== TABELA DE PREÇOS ===');
    console.log('Método      | Preço Final | Taxa');
    console.log('------------|-------------|------');
    console.log(`PIX         | ${formatPrice(prices.retail.pix)} | 0%`);
    console.log(`Débito      | ${formatPrice(prices.retail.debit)} | 1%`);

    [0, 1, 5, 11].forEach(i => {
        const option = prices.retail.credit[i];
        console.log(
            `${option.installments}x          | ${formatPrice(option.totalPrice)} | ${option.fee}%`
        );
    });

    // Expected output:
    // Método      | Preço Final | Taxa
    // ------------|-------------|------
    // PIX         | R$ 4.299,00 | 0%
    // Débito      | R$ 4.341,99 | 1%
    // 1x          | R$ 4.599,93 | 7%
    // 2x          | R$ 4.642,92 | 8%
    // 6x          | R$ 4.857,87 | 13%
    // 12x         | R$ 5.029,83 | 17%
}

export {
    example1_getAllPrices,
    example2_getBestPrice,
    example3_productCard,
    example4_priceTable
};
