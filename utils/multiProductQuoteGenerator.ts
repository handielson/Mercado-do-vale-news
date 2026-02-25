import type { QuoteCartItem } from '@/contexts/QuoteCartContext';
import { formatPrice } from '@/services/installmentCalculator';

/**
 * Generate WhatsApp quote message for multiple products
 * Respects payment options selected for each item
 */
export function generateMultiProductQuoteMessage(
    items: QuoteCartItem[],
    couponCode?: string,
    couponDiscount?: number,
    referrerName?: string,
    referralCode?: string,
    storeAddress?: string
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

    const cashItems = items.filter(i => !((i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1));
    const installmentItems = items.filter(i => (i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1);

    const cashSubtotal = cashItems.reduce((s, i) => s + i.price + (i.warranty?.price || 0), 0);
    const installmentSubtotal = installmentItems.reduce((s, i) => s + i.installmentPlan.total + (i.warranty?.price || 0), 0);
    const grandTotal = cashSubtotal + installmentSubtotal;

    const isMixed = cashItems.length > 0 && installmentItems.length > 0;
    const onlyCash = installmentItems.length === 0;

    message += `\n*\u2501\u2501\u2501 RESUMO DO OR\u00c7AMENTO \u2501\u2501\u2501*\n`;

    // Subtotal
    if (onlyCash) {
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
    if (couponCode && couponDiscount && couponDiscount > 0) {
        const discountCents = Math.round(couponDiscount * 100);
        const finalTotal = grandTotal - discountCents;
        message += `\ud83c\udf9f\ufe0f Cupom *${couponCode}*: -${formatPrice(discountCents)}\n`;
        message += `\u2705 *Total com desconto: ${formatPrice(Math.max(0, finalTotal))}*\n`;
    }

    // Referral code tag
    if (referralCode) {
        if (referrerName) {
            message += `\n🤝 Indicação de: ${referrerName} (Cód: ${referralCode})\n`;
        } else {
            message += `\n🤝 Indicação (Cód): ${referralCode}\n`;
        }
    }

    if (storeAddress) {
        message += `\n*🏪 RETIRADA NA LOJA*\n`;
        message += `📍 ${storeAddress}\n`;
        message += `🗺️ Maps: https://maps.google.com/?q=${encodeURIComponent(storeAddress)}\n`;
    }

    message += `\n---\n`;
    message += `\ud83c\udfaf *Or\u00e7amento exclusivo Mercado do Vale!*\n`;
    message += `Garanta o seu agora enquanto est\u00e1 dispon\u00edvel em estoque! \ud83d\udd25`;

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
    couponCode?: string,
    couponDiscount?: number,
    referrerName?: string,
    referralCode?: string,
    storeAddress?: string
): string {
    const message = generateMultiProductQuoteMessage(items, couponCode, couponDiscount, referrerName, referralCode, storeAddress);
    const encodedMessage = encodeURIComponent(message);

    if (!whatsappNumber) {
        return `whatsapp://send?text=${encodedMessage}`;
    }

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

