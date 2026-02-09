import type { CatalogProduct } from '@/types/catalog';
import type { InstallmentPlan } from '@/services/installmentCalculator';
import type { Address } from '@/services/addressLookup';
import type { VariantSpecs } from '@/services/productVariants';
import { supabase } from '@/services/supabase';

/**
 * Delivery option type
 */
export interface DeliveryOption {
    type: 'pickup' | 'delivery';
    address?: Address;
    notes?: string;
}

/**
 * Quote request for WhatsApp
 */
export interface QuoteRequest {
    product: CatalogProduct;
    variant: VariantSpecs;
    installmentPlan: InstallmentPlan;
    delivery: DeliveryOption;
}

/**
 * Generate formatted WhatsApp quote message
 */
export function generateQuoteMessage(quote: QuoteRequest): string {
    const { product, variant, installmentPlan, delivery } = quote;

    // Format date
    const date = new Date().toLocaleDateString('pt-BR');

    // Product name with variant
    const productName = `${product.name} ${variant.ram || ''}/${variant.storage || ''}`.trim();

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
    let message = `*📱 ORÇAMENTO DE PRODUTOS*\n`;
    message += `📅 Data: ${date}\n\n`;
    message += `*ITENS:*\n`;
    message += `• ${productName}\n`;

    if (variant.color) {
        message += `  Cor: ${variant.color}\n`;
    }

    message += `  ${priceAtVista} à vista\n`;

    if (installmentPlan.installments > 1) {
        message += `  💳 ${installmentPlan.installments}x de ${installmentValue} (Total: ${installmentTotal})\n`;
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

        if (delivery.notes) {
            message += `Obs: ${delivery.notes}\n`;
        }
    } else {
        message += `\n*🏪 RETIRADA NA LOJA*\n`;
    }

    message += `\n---\n`;
    message += `🎯 *Orçamento exclusivo Mercado do Vale!*\n`;
    message += `Garanta o seu agora enquanto está disponível em estoque! 🔥`;

    return message;
}

/**
 * Generate WhatsApp link with pre-filled message
 */
export async function generateWhatsAppLink(message: string): Promise<string> {
    try {
        // Fetch company phone from company_settings
        const { data, error } = await supabase
            .from('company_settings')
            .select('phone')
            .single();

        if (error || !data?.phone) {
            throw new Error('Número do WhatsApp não configurado');
        }

        // Clean phone number (remove non-numeric characters)
        const cleanPhone = data.phone.replace(/\D/g, '');

        // Encode message for URL
        const encodedMessage = encodeURIComponent(message);

        // Generate WhatsApp link
        return `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    } catch (error) {
        console.error('Error generating WhatsApp link:', error);
        throw error;
    }
}
