/**
 * cartShareUtils.ts
 * Generates WhatsApp-ready text for cart sharing.
 * - ADMIN: budget with product links, available colors, and installment info
 * - Client: new order with selected variants, optional address, delivery info
 */

import { supabase } from '@/services/supabase';
import { calculateInstallments, formatPrice } from '@/services/installmentCalculator';

const SITE_BASE = 'https://mercadodovale.com.br';

/** Build the public product URL from its slug */
export function getProductUrl(product: any): string {
    const slug = product.slug || product.id;
    return `${SITE_BASE}/produto/${slug}`;
}

/** Fetch distinct colors of sibling products (same model_id) */
export async function fetchSiblingColors(product: any): Promise<string[]> {
    const modelId = product.model_id;
    if (!modelId) {
        const color = product.specs?.color || product.specs?.Cor;
        return color ? [color] : [];
    }

    try {
        const { data } = await supabase
            .from('products')
            .select('specs')
            .eq('model_id', modelId)
            .gt('stock', 0); // apenas em estoque

        if (!data) return [];

        const colors = [
            ...new Set(
                data
                    .map((p: any) => p.specs?.color || p.specs?.Cor)
                    .filter(Boolean)
            )
        ] as string[];

        return colors;
    } catch {
        return [];
    }
}

/** Format date as DD/MM/YYYY */
function formatDate(date: Date = new Date()): string {
    return date.toLocaleDateString('pt-BR');
}

/** Pad currency value for alignment */
function brl(cents: number): string {
    return formatPrice(cents);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Budget text
// ─────────────────────────────────────────────────────────────────────────────

export async function generateBudgetText(
    items: Array<{ product: any; unit_price: number; quantity: number }>
): Promise<string> {
    const lines: string[] = [
        '📝 ORÇAMENTO DE PRODUTOS',
        `📅 Data: ${formatDate()}`,
        '',
        'ITENS:',
    ];

    for (const item of items) {
        const { product, unit_price, quantity } = item;
        const subtotal = unit_price * quantity;

        // Installments (12x)
        const plans = await calculateInstallments(subtotal, 12);
        const plan12 = plans.find(p => p.installments === 12);
        const pixPlan = plans[0]; // à vista

        // Sibling colors
        const colors = await fetchSiblingColors(product);

        // Product name + optional qty
        const qtyLabel = quantity > 1 ? ` (${quantity}x)` : '';
        lines.push(`* ${product.name}${qtyLabel}`);
        lines.push(`  🔗 ${getProductUrl(product)}`);
        lines.push(`  ${brl(pixPlan?.total ?? subtotal)} à vista`);

        if (plan12) {
            lines.push(
                `  💳 12x de ${brl(plan12.value)} (Total: ${brl(plan12.total)})`
            );
        }

        if (colors.length > 0) {
            lines.push(`  Cores disponíveis: ${colors.join(', ')}`);
        }

        lines.push('');
    }

    // Grand total (pix/à vista)
    const grandTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    if (items.length > 1) {
        const grandPlans = await calculateInstallments(grandTotal, 12);
        const grandPixPlan = grandPlans[0];
        const grandPlan12 = grandPlans.find(p => p.installments === 12);

        lines.push('---');
        lines.push(`Total a vista: ${brl(grandPixPlan?.total ?? grandTotal)}`);

        if (grandPlan12) {
            lines.push(
                `Total no cartao: 12x de ${brl(grandPlan12.value)} (Total: ${brl(grandPlan12.total)})`
            );
        }
    }

    lines.push(SITE_BASE);

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT: New order text
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientOrderItem {
    product: any;
    unit_price: number;
    quantity: number;
    selected_color?: string;
    selected_memory?: string; // RAM/Storage chosen by client
}

export interface ClientOrderOptions {
    delivery: { type: 'pickup' | 'delivery'; shippingOption?: any };
    paymentLabel: string;   // e.g. "PIX" or "Cartão de Crédito 12x"
    grandTotal: number;     // centavos
    address?: string;       // optional free-text address
}

export function generateClientOrderText(
    items: ClientOrderItem[],
    opts: ClientOrderOptions
): string {
    const { delivery, paymentLabel, grandTotal, address } = opts;

    const lines: string[] = [
        '🛒 *Novo Pedido - Mercado do Vale*',
        `📅 ${formatDate()}`,
        '',
        'ITENS:',
    ];

    for (const item of items) {
        const { product, unit_price, quantity, selected_color, selected_memory } = item;
        const variantParts = [selected_memory, selected_color].filter(Boolean).join(' • ');
        const variantLabel = variantParts ? ` — ${variantParts}` : '';
        const qtyLabel = quantity > 1 ? ` (x${quantity})` : '';

        lines.push(`* ${product.name}${variantLabel}${qtyLabel}  ${formatPrice(unit_price * quantity)}`);
        lines.push(`  🔗 ${getProductUrl(product)}`);
    }

    lines.push('');
    lines.push(`💰 *Pagamento:* ${paymentLabel}`);

    if (delivery.type === 'delivery' && delivery.shippingOption) {
        const freight = formatPrice(Math.round((delivery.shippingOption.price ?? 0) * 100));
        lines.push(`🚚 *Entrega:* ${delivery.shippingOption.name} — ${freight}`);
    } else {
        lines.push('🏪 *Retirada na loja*');
    }

    if (address?.trim()) {
        lines.push(`📍 *Endereço:* ${address.trim()}`);
    }

    lines.push('');
    lines.push(`*Total: ${formatPrice(grandTotal)}*`);

    return lines.join('\n');
}
