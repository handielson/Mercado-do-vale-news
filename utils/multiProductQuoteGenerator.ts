import type { QuoteCartItem } from '@/contexts/QuoteCartContext';
import { formatPrice } from '@/services/installmentCalculator';

/**
 * Generate WhatsApp quote message for multiple products
 * Respects payment options selected for each item
 */
export function generateMultiProductQuoteMessage(items: QuoteCartItem[]): string {
    if (items.length === 0) {
        return '';
    }

    let message = `*📝 ORÇAMENTO DE PRODUTOS*\n`;
    message += `📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    message += `*ITENS:*\n`;

    items.forEach((item, index) => {
        // Extract base product name without specs (if they exist)
        // Product name might be like "Redmi note 15 pró 4g, 256GB/8GB" or just "Redmi note 15 pró 4g"
        let productName = item.product.name;

        // Remove any existing RAM/Storage pattern from the name
        // Patterns: "256GB/8GB", "8GB/256GB", "12GB/512GB", etc.
        productName = productName.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();

        // Build the product info with name and specs on separate lines
        message += `\n${index + 1}. *${productName}*\n`;

        // Only show RAM/Storage if they exist (smartphones)
        if (item.variant.ram && item.variant.storage) {
            message += `   📱 ${item.variant.ram}/${item.variant.storage}\n`;
        }

        // Cash price (if selected OR if paymentOptions doesn't exist - backward compatibility)
        if (item.paymentOptions?.showCash ?? true) {
            message += `   💰 ${formatPrice(item.price)} à vista\n`;
        }

        // Installment price (if selected OR if paymentOptions doesn't exist - backward compatibility)
        if ((item.paymentOptions?.showInstallment ?? true) && item.installmentPlan.installments > 1) {
            const { installments, value, total } = item.installmentPlan;
            message += `   💳 ${installments}x de ${formatPrice(value)}\n`;
            message += `      Total: ${formatPrice(total)}\n`;
        }

        // Available colors
        if (item.availableColors.length > 0) {
            message += `   🎨 Cores: ${item.availableColors.join(', ')}\n`;
        }
    });

    // ─── Totals: respect each item's payment mode ───────────────────────────
    // An item is "parcelado" if: showInstallment is true AND installments > 1
    // Otherwise it's treated as "à vista" (even if both options are shown)
    const cashItems = items.filter(i => !((i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1));
    const installmentItems = items.filter(i => (i.paymentOptions?.showInstallment ?? true) && i.installmentPlan.installments > 1);

    const cashSubtotal = cashItems.reduce((s, i) => s + i.price, 0);
    const installmentSubtotal = installmentItems.reduce((s, i) => s + i.installmentPlan.total, 0);
    const grandTotal = cashSubtotal + installmentSubtotal;

    const isMixed = cashItems.length > 0 && installmentItems.length > 0;
    const onlyCash = installmentItems.length === 0;
    const onlyCredit = cashItems.length === 0;

    message += `\n*━━━ RESUMO DO ORÇAMENTO ━━━*\n`;

    if (onlyCash) {
        // All items à vista
        message += `💰 Total à vista: *${formatPrice(grandTotal)}*\n`;
    } else if (onlyCredit) {
        // All items parcelado
        const maxInstallments = Math.max(...installmentItems.map(i => i.installmentPlan.installments));
        message += `💳 Total parcelado (${maxInstallments}x): *${formatPrice(grandTotal)}*\n`;
    } else {
        // Mixed cart
        message += `💰 Itens à vista: *${formatPrice(cashSubtotal)}*\n`;
        message += `💳 Itens parcelados: *${formatPrice(installmentSubtotal)}*\n`;
        message += `📊 Total geral: *${formatPrice(grandTotal)}*\n`;
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
    whatsappNumber?: string
): string {
    const message = generateMultiProductQuoteMessage(items);
    const encodedMessage = encodeURIComponent(message);

    // If no number provided, open WhatsApp with message ready (user chooses recipient)
    if (!whatsappNumber) {
        return `whatsapp://send?text=${encodedMessage}`;
    }

    // If number provided, send to specific contact
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

