import type { QuoteCartItem } from '@/contexts/QuoteCartContext';
import { formatPrice } from '@/services/installmentCalculator';

import type { MixedPaymentState } from '@/components/catalog/MixedPaymentSimulator';

export interface MultiQuoteOptions {
    couponCode?: string;
    couponDiscount?: number;
    referrerName?: string;
    referralCode?: string;
    storeAddress?: string;
    mixedPaymentState?: MixedPaymentState | null;
}

const SITE_BASE = 'https://mercadodovale.com.br';

function buildQuoteCalculatorUrl(totalCents: number, cashCents: number, selectedInstallment?: number | null): string {
    const params = new URLSearchParams({
        total: String(Math.max(0, Math.round(totalCents))),
        entrada: String(Math.max(0, Math.round(cashCents))),
    });

    if (selectedInstallment) {
        params.set('parcela', String(selectedInstallment));
    }

    return `${SITE_BASE}/calculadora-orcamento?${params.toString()}`;
}

function getBudgetCashTotal(items: QuoteCartItem[]): number {
    return items.reduce((sum, item) => sum + item.price + (item.warranty?.price || 0), 0);
}

function appendMixedPaymentSummary(
    message: string,
    totalBudgetCents: number,
    mixedPaymentState: MixedPaymentState
): string {
    const cashCents = Math.max(0, mixedPaymentState.cashCents || 0);
    const cardCents = Math.max(0, mixedPaymentState.cardCents || 0);
    const options = mixedPaymentState.cardOptions || [];
    const selectedOption = mixedPaymentState.cardOption;

    message += `\ud83d\udcca Valor do orcamento: *${formatPrice(totalBudgetCents)}*\n`;

    if (cashCents > 0) {
        message += `\ud83d\udcb5 Entrada Pix/Dinheiro: *${formatPrice(cashCents)}*\n`;
    }

    if (cardCents > 0) {
        message += `\ud83d\udcb3 Restante no cartao: *${formatPrice(cardCents)}*\n`;
    }

    if (selectedOption) {
        message += `\ud83d\udcb3 Cartao: *${selectedOption.installments}x de ${formatPrice(selectedOption.monthlyValue)}*`;
        message += ` (total cartao ${formatPrice(selectedOption.totalWithFee)})\n`;
        message += `\ud83d\udcca Total geral: *${formatPrice(cashCents + selectedOption.totalWithFee)}*\n`;
    } else if (cardCents > 0 && options.length > 0) {
        message += `\n*Parcelamento do restante no cartao:*\n`;
        options.forEach((option) => {
            message += `${option.installments}x de ${formatPrice(option.monthlyValue)} - total ${formatPrice(option.totalWithFee)}\n`;
        });
    } else if (cardCents === 0 && cashCents > 0) {
        message += `\u2705 Pagamento completo no Pix/Dinheiro\n`;
    }

    message += `\nCalculadora do orcamento: ${buildQuoteCalculatorUrl(totalBudgetCents, cashCents, mixedPaymentState.selectedInstallment)}\n`;

    return message;
}

/**
 * Generate WhatsApp quote message for multiple products
 * Respects payment options selected for each item
 */
export function generateMultiProductQuoteMessage(
    items: QuoteCartItem[],
    quoteOptions?: MultiQuoteOptions
): string {
    if (items.length === 0) {
        return '';
    }

    let message = `*\ud83d\udcdd OR\u00c7AMENTO DE PRODUTOS*\n`;
    message += `\ud83d\udcc5 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    message += `*ITENS:*\n`;

    items.forEach((item, index) => {
        let productName = item.product.name;
        productName = productName.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();

        message += `\n${index + 1}. *${productName}*\n`;

        if (item.variant.ram && item.variant.storage) {
            message += `   \ud83d\udcf1 ${item.variant.ram}/${item.variant.storage}\n`;
        }

        if (item.variant.color) {
            message += `   \ud83c\udfa8 Cor: ${item.variant.color}\n`;
        }

        if (item.paymentOptions?.showCash ?? true) {
            message += `   \ud83d\udcb0 ${formatPrice(item.price)} \u00e0 vista\n`;
        }

        if ((item.paymentOptions?.showInstallment ?? true) && item.installmentPlan.installments > 1) {
            const { installments, value, total } = item.installmentPlan;
            message += `   \ud83d\udcb3 ${installments}x de ${formatPrice(value)}\n`;
            message += `      Total: ${formatPrice(total)}\n`;
        }

        if (item.availableColors.length > 0) {
            message += `   \ud83c\udfa8 Cores: ${item.availableColors.join(', ')}\n`;
        }

        if (item.warranty) {
            message += `   \ud83d\udee1\ufe0f Garantia Estendida: +${item.warranty.months} Meses (+${formatPrice(item.warranty.price)})\n`;
        }
    });

    const totalBudgetCents = getBudgetCashTotal(items);
    const cashItems = items.filter(i => !((i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1));
    const installmentItems = items.filter(i => (i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1);

    const cashSubtotal = cashItems.reduce((s, i) => s + i.price + (i.warranty?.price || 0), 0);
    const installmentSubtotal = installmentItems.reduce((s, i) => s + i.installmentPlan.total + (i.warranty?.price || 0), 0);
    const grandTotal = cashSubtotal + installmentSubtotal;

    const isMixed = cashItems.length > 0 && installmentItems.length > 0;
    const onlyCash = installmentItems.length === 0;

    message += `\n*\u2501\u2501\u2501 RESUMO DO OR\u00c7AMENTO \u2501\u2501\u2501*\n`;

    if (quoteOptions?.mixedPaymentState) {
        message = appendMixedPaymentSummary(message, totalBudgetCents, quoteOptions.mixedPaymentState);
    } else if (onlyCash) {
        message += `\ud83d\udcb0 Total \u00e0 vista: *${formatPrice(grandTotal)}*\n`;
    } else if (!isMixed) {
        const maxInstallments = Math.max(...installmentItems.map(i => i.installmentPlan.installments));
        message += `\ud83d\udcb3 Total parcelado (${maxInstallments}x): *${formatPrice(grandTotal)}*\n`;
    } else {
        message += `\ud83d\udcb0 Itens \u00e0 vista: *${formatPrice(cashSubtotal)}*\n`;
        message += `\ud83d\udcb3 Itens parcelados: *${formatPrice(installmentSubtotal)}*\n`;
        message += `\ud83d\udcca Total geral: *${formatPrice(grandTotal)}*\n`;
    }

    // Coupon discount line
    if (quoteOptions?.couponCode && quoteOptions.couponDiscount && quoteOptions.couponDiscount > 0) {
        const discountCents = Math.round(quoteOptions.couponDiscount * 100);
        const finalTotal = grandTotal - discountCents;
        message += `\n🎟️ Cupom *${quoteOptions.couponCode}*: -${formatPrice(discountCents)}\n`;
        message += `✅ *Total com desconto: ${formatPrice(Math.max(0, finalTotal))}*\n`;
    }

    // Referral code tag
    if (quoteOptions?.referralCode) {
        if (quoteOptions.referrerName) {
            message += `\n🤝 Indicação de: ${quoteOptions.referrerName} (Cód: ${quoteOptions.referralCode})\n`;
        } else {
            message += `\n🤝 Indicação (Cód): ${quoteOptions.referralCode}\n`;
        }
    }

    if (quoteOptions?.storeAddress) {
        message += `\n*🏪 RETIRADA NA LOJA*\n`;
        message += `📍 ${quoteOptions.storeAddress}\n`;
        message += `🗺️ Maps: https://maps.google.com/?q=${encodeURIComponent(quoteOptions.storeAddress)}\n`;
    }

    message += `\n---\n`;
    message += `🎯 *Orçamento exclusivo Mercado do Vale!*\n`;
    message += `Garanta o seu agora enquanto está disponível em estoque! 🔥`;

    return message;
}


/**
 * Generate WhatsApp link with multi-product quote
 * @param items - Cart items
 * @param whatsappNumber - Optional phone number. If not provided, opens WhatsApp without recipient
 */
export function generateMultiProductWhatsAppLink(
    items: QuoteCartItem[],
    whatsappNumber?: string,
    quoteOptions?: MultiQuoteOptions
): string {
    const message = generateMultiProductQuoteMessage(items, quoteOptions);
    const encodedMessage = encodeURIComponent(message);

    if (!whatsappNumber) {
        return `whatsapp://send?text=${encodedMessage}`;
    }

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

