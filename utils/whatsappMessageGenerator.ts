import type { CatalogProduct } from '@/types/catalog';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import type { Address } from '@/services/addressLookup';
import type { VariantSpecs } from '@/services/productVariants';
import type { ShippingOption } from '@/types/shipping';
import type { MixedPaymentState } from '@/components/catalog/MixedPaymentSimulator';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';

const SITE_BASE = 'https://mercadodovale.com.br';

function brl(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function buildQuoteCalculatorUrl(
    totalCents: number,
    cashCents: number,
    selectedInstallment?: number | null,
    productName?: string,
    variation?: string
): string {
    const params = new URLSearchParams({
        total: String(Math.max(0, Math.round(totalCents))),
        entrada: String(Math.max(0, Math.round(cashCents))),
    });

    if (selectedInstallment) params.set('parcela', String(selectedInstallment));
    if (productName) params.set('produto', productName);
    if (variation) params.set('variacao', variation);

    return `${SITE_BASE}/calculadora-orcamento?${params.toString()}`;
}

function installmentLabel(installments: number): string {
    const labels: Record<number, string> = {
        1: '1️⃣',
        2: '2️⃣',
        3: '3️⃣',
        4: '4️⃣',
        5: '5️⃣',
        6: '6️⃣',
        7: '7️⃣',
        8: '8️⃣',
        9: '9️⃣',
        10: '10️⃣',
        11: '11️⃣',
        12: '12️⃣',
    };
    return labels[installments] || `${installments}`;
}

function formatInstallmentLine(option: { installments: number; monthlyValue: number; totalWithFee: number }): string {
    return `${installmentLabel(option.installments)}x de ${brl(option.monthlyValue)} = ${brl(option.totalWithFee)}`;
}

function formatMixedPaymentLines(
    state: MixedPaymentState,
    totalBudgetCents: number,
    indent = '',
    productName?: string,
    variation?: string
): string {
    let text = '';
    const cashCents = Math.max(0, state.cashCents || 0);
    const cardCents = Math.max(0, state.cardCents || 0);
    const selectedOption = state.cardOption;
    const options = state.cardOptions || [];

    text += `${indent}Pagamento\n`;
    text += `${indent}Valor do orcamento: ${brl(totalBudgetCents)}\n`;
    if (cashCents > 0) text += `${indent}Entrada Pix/Dinheiro: ${brl(cashCents)}\n`;
    if (cardCents > 0) text += `${indent}Restante no cartao: ${brl(cardCents)}\n`;

    if (selectedOption) {
        text += `\n${indent}Cartao:\n`;
        text += `${indent}${formatInstallmentLine(selectedOption)}\n`;
        text += `${indent}Total geral: ${brl(cashCents + selectedOption.totalWithFee)}\n`;
    } else if (cardCents > 0 && options.length > 0) {
        text += `\n${indent}Cartao:\n`;
        options.forEach((option) => {
            text += `${indent}${formatInstallmentLine(option)}\n`;
        });
    } else if (cardCents === 0 && cashCents > 0) {
        text += `${indent}Pagamento completo no Pix/Dinheiro\n`;
    }

    text += `\n${indent}Faça sua simulação:\n`;
    text += `${indent}${buildQuoteCalculatorUrl(totalBudgetCents, cashCents, state.selectedInstallment, productName, variation)}\n`;

    return text;
}

/**
 * Delivery option type
 */
export interface DeliveryOption {
    type: 'pickup' | 'delivery';
    address?: Address;
    notes?: string;
    shippingOption?: ShippingOption;
}

/**
 * Quote request for WhatsApp
 */
export interface QuoteRequest {
    product: CatalogProduct;
    variant: VariantSpecs;
    installmentPlan: InstallmentPlan;
    delivery: DeliveryOption;
    userType?: 'ADMIN' | 'retail' | 'resale' | 'wholesale';
    availableColors?: string[];
    couponCode?: string;
    couponDiscount?: number; // valor em R$
    referrerName?: string;
    referralCode?: string;
    storeAddress?: string;
    selectedWarranty?: { months: number; price: number };
    paymentOptions?: { showCash: boolean; showInstallment: boolean };
    mixedPaymentState?: MixedPaymentState | null;
    cashPrice?: number;
}

/**
 * Generate formatted WhatsApp quote message
 */
export function generateQuoteMessage(quote: QuoteRequest): string {
    const { product, variant, installmentPlan, delivery, userType, availableColors, couponCode, couponDiscount, selectedWarranty, paymentOptions } = quote;

    // Check if user is admin (ADMIN type indicates admin/staff)
    const isAdmin = userType === 'ADMIN';

    // Check if wholesale (no card payment for wholesale)
    const isWholesale = userType === 'wholesale';

    // Format date
    const date = new Date().toLocaleDateString('pt-BR');

    // Product name (already includes specs, no need to duplicate)
    const productName = product.name;

    // Price formatting
    const priceAtVista = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(installmentPlan.total / 100);

    const installmentValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(installmentPlan.value / 100);

    const installmentTotal = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(installmentPlan.total / 100);

    // Build message
    let message = '';

    if (isAdmin) {
        // Admin/Staff format
        message = `*📝 ORÇAMENTO DE PRODUTOS*\n`;
        message += `📅 Data: ${date}\n\n`;
        message += `*ITENS:*\n`;
        message += `• ${productName}\n`;
        if (variant.ram && variant.storage) {
            message += `  📱 ${variant.ram}/${variant.storage}\n`;
        }
        if (quote.mixedPaymentState) {
            message += formatMixedPaymentLines(
                quote.mixedPaymentState,
                quote.cashPrice || installmentPlan.total,
                '  ',
                productName,
                [variant.ram && variant.storage ? `${variant.ram}/${variant.storage}` : '', variant.color].filter(Boolean).join(' ')
            );
        } else if (false) {
            if (quote.mixedPaymentState.cashCents > 0 && quote.mixedPaymentState.selectedInstallment) {
                const cashFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.mixedPaymentState.cashCents / 100);
                message += `  À Vista (Pix): ${cashFmt}\n`;
                const opt = quote.mixedPaymentState.cardOption!;
                const moFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.monthlyValue / 100);
                const totFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.totalWithFee / 100);
                message += `  💳 Cartão: ${opt.installments}x de ${moFmt} (Total cart.: ${totFmt})\n`;
            } else if (quote.mixedPaymentState.selectedInstallment) {
                const opt = quote.mixedPaymentState.cardOption!;
                const moFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.monthlyValue / 100);
                const totFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.totalWithFee / 100);
                message += `  💳 Cartão: ${opt.installments}x de ${moFmt} (Total: ${totFmt})\n`;
            } else if (quote.mixedPaymentState.cashCents > 0) {
                const cashFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.mixedPaymentState.cashCents / 100);
                message += `  🟢 À Vista (Pix): ${cashFmt}\n`;
            }
        } else {
            if (paymentOptions?.showCash !== false) {
                message += `  ${priceAtVista} a vista\n`;
            }

            // Show card payment only if NOT wholesale
            if (!isWholesale && installmentPlan.installments > 1 && paymentOptions?.showInstallment !== false) {
                message += `  💳 ${installmentPlan.installments}x de ${installmentValue} (Total: ${installmentTotal})\n`;
            }
        }

        if (selectedWarranty) {
            const warrantyPriceFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedWarranty.price / 100);
            message += `  🛡️ Garantia Est.: +${selectedWarranty.months} Meses (+${warrantyPriceFmt})\n`;
        }

        // Show available colors if provided
        if (availableColors && availableColors.length > 0) {
            message += `  Cores disponíveis: ${availableColors.join(', ')}\n`;
        }

        message += `\n---\n`;
        message += `🎯 *Orçamento exclusivo Mercado do Vale!*\n`;
        message += `Garanta o seu agora enquanto está disponível em estoque! 🔥`;
    } else {
        // Customer format (original)
        message = `*📱 ORÇAMENTO DE PRODUTOS*\n`;
        message += `*ITENS:*\n`;

        const specs = [];
        if (variant.ram && variant.storage) specs.push(`${variant.ram}/${variant.storage}`);
        if (variant.color) specs.push(variant.color);

        message += `• ${productName}`;
        if (specs.length > 0) message += `, ${specs.join(', ')}`;
        message += ` \n`;
        const productSlug = product.slug || product.id;
        if (productSlug) {
            message += `🔗 https://mercadodovale.com.br/produto/${productSlug}\n`;
        }

        if (selectedWarranty) {
            const warrantyPriceFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedWarranty.price / 100);
            message += `🛡️ Garantia Est.: +${selectedWarranty.months} Meses (+${warrantyPriceFmt})\n`;
        }

        const cashTotal = quote.cashPrice ? quote.cashPrice / 100 : installmentPlan.total / 100;

        message += `\n*💰 VALOR TOTAL DA COMPRA*\n`;
        message += `Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cashTotal)}\n`;

        message += `\n*💳 PAGAMENTO*\n`;
        if (quote.mixedPaymentState) {
            message += formatMixedPaymentLines(
                quote.mixedPaymentState,
                quote.cashPrice || installmentPlan.total,
                '',
                productName,
                specs.join(' ')
            );
        } else if (false) {
            if (quote.mixedPaymentState.cashCents > 0 && quote.mixedPaymentState.selectedInstallment) {
                const cashFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.mixedPaymentState.cashCents / 100);
                message += `À Vista (Pix): ${cashFmt}\n`;
                const opt = quote.mixedPaymentState.cardOption!;
                const moFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.monthlyValue / 100);
                const totFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.totalWithFee / 100);
                message += `Cartão: ${opt.installments}x de ${moFmt} (Total cart.: ${totFmt})\n`;
            } else if (quote.mixedPaymentState.selectedInstallment) {
                const opt = quote.mixedPaymentState.cardOption!;
                const moFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.monthlyValue / 100);
                const totFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opt.totalWithFee / 100);
                message += `Parcelado: ${opt.installments}x de ${moFmt} (Total: ${totFmt})\n`;
            } else if (quote.mixedPaymentState.cashCents > 0) {
                const cashFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.mixedPaymentState.cashCents / 100);
                message += `À vista (Pix/Dinheiro): ${cashFmt}\n`;
            }
        } else {
            // Standard
            if (paymentOptions?.showCash !== false) {
                message += `À vista: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cashTotal)}\n`;
            }
            if (installmentPlan.installments > 1 && paymentOptions?.showInstallment !== false) {
                message += `Parcelado: ${installmentPlan.installments}x de ${installmentValue} (Total: ${installmentTotal})\n`;
            }
        }

        // Delivery information
        if (delivery.type === 'delivery' && delivery.address) {
            message += `\n*🚚 ENTREGA:*\n`;
            message += `${delivery.address.street}`;
            if (delivery.address.number) {
                message += `, ${delivery.address.number}`;
            }
            if (delivery.address.complement) {
                message += ` - ${delivery.address.complement}`;
            }
            message += `\n`;
            message += `Bairro ${delivery.address.neighborhood}, ${delivery.address.city} - ${delivery.address.state}\n`;
            message += `CEP: ${delivery.address.cep}\n`;

            // Shipping option selected
            if (delivery.shippingOption) {
                const s = delivery.shippingOption;
                const price = s.isFree ? 'Grátis 🎉' : `R$ ${s.price.toFixed(2).replace('.', ',')} — ${s.daysLabel}`;
                message += `Frete: ${s.name} (${price})\n`;
            }

            const mapQuery = `${delivery.address.street}, ${delivery.address.number || ''}, Bairro ${delivery.address.neighborhood}, ${delivery.address.city} - ${delivery.address.state} - CEP: ${delivery.address.cep}`;
            message += `🗺️ Maps: https://maps.google.com/?q=${encodeURIComponent(mapQuery)}\n`;

            if (delivery.notes) {
                message += `Obs: ${delivery.notes}\n`;
            }
        } else {
            message += `\n*🏪 RETIRADA NA LOJA*\n`;
            if (quote.storeAddress) {
                message += `📍 ${quote.storeAddress}\n`;
                message += `🗺️ Maps: https://maps.google.com/?q=${encodeURIComponent(quote.storeAddress)}\n`;
            }
        }

        message += `\n---\n`;
        message += `_Mercado do Vale_`;
    }

    // Coupon discount line (both admin and customer formats)
    if (couponCode && couponDiscount && couponDiscount > 0) {
        const discountFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(couponDiscount);
        const finalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            Math.max(0, installmentPlan.total / 100 - couponDiscount)
        );
        message += `\n🎟️ Cupom *${couponCode}*: -${discountFormatted}\n`;
        message += `✅ *Total com desconto: ${finalFormatted}*\n`;
    }

    // Referral code tag
    if (quote.referralCode) {
        if (quote.referrerName) {
            message += `\n🤝 Indicação de: ${quote.referrerName} (Cód: ${quote.referralCode})\n`;
        } else {
            message += `\n🤝 Indicação (Cód): ${quote.referralCode}\n`;
        }
    }

    return message;
}

/**
 * Generate WhatsApp link with pre-filled message
 */
export async function generateWhatsAppLink(message: string): Promise<string> {
    try {
        const settings = await publicCompanySettingsService.get();
        const phone = settings?.phone;

        if (!phone) {
            throw new Error('Número do WhatsApp não está configurado nas configurações da empresa');
        }

        // Clean phone number (remove non-numeric characters)
        const cleanPhone = phone.replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length < 10) {
            throw new Error('Número do WhatsApp inválido nas configurações');
        }

        // Encode message for URL
        const encodedMessage = encodeURIComponent(message);

        // Generate WhatsApp link
        // Use api.whatsapp.com for better mobile compatibility
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const baseUrl = isMobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send';

        return `${baseUrl}?phone=55${cleanPhone}&text=${encodedMessage}`;
    } catch (error) {
        console.error('Error generating WhatsApp link:', error);
        throw error;
    }
}
