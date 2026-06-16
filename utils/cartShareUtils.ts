/**
 * cartShareUtils.ts
 * Generates WhatsApp-ready text for cart sharing.
 * - ADMIN: budget with product links, available colors, and installment info
 * - Client: new order with selected variants, optional address, delivery info
 */

import { calculateInstallments, formatPrice } from '@/services/installmentCalculator';
import { vpsApiService } from '@/services/vpsApiService';

const SITE_BASE = 'https://mercadodovale.com.br';

/** Build the public product URL from its slug */
export function getProductUrl(product: any): string {
    const slug = product.slug || product.id;
    return `${SITE_BASE}/produto/${slug}`;
}

type VariationSummary = Array<{ label: string; values: string[] }>;
type BudgetVariantGroup = {
    key: string;
    label: string;
    specLine: string;
    name: string;
    price: number;
    colors: string[];
    products: any[];
};

const VARIATION_LABELS: Record<string, string> = {
    color: 'Cores',
    cor: 'Cores',
    colour: 'Cores',
    storage: 'Memórias',
    memoria: 'Memórias',
    memory: 'Memórias',
    armazenamento: 'Memórias',
    ram: 'RAMs',
    material: 'Materiais',
};

const ALLOWED_VARIATION_KEYS = new Set([
    'color',
    'cor',
    'colour',
    'storage',
    'memoria',
    'memory',
    'armazenamento',
    'ram',
    'material',
]);

const IGNORED_SPEC_KEYS = new Set([
    'color_hex',
    'cor_hex',
    'dimensions.depth',
    'dimensions.depth_cms',
    'dimensions.height',
    'dimensions.height_cms',
    'dimensions.width',
    'dimensions.width_cms',
    'imei',
    'imei1',
    'imei2',
    'serial',
    'inmetro_certificate',
    'meta_description',
    'meta_descriptions',
    'meta_title',
    'meta_titles',
    'slug',
    'slugs',
    'weight_kg',
    'weight_kgs',
]);

function normalizeSpecKey(key: string): string {
    return key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function titleizeSpecKey(key: string): string {
    return key
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/(^|\s)(\S)/g, (_, sep, char) => `${sep}${char.toUpperCase()}`);
}

function pluralizeSpecLabel(key: string): string {
    const normalized = normalizeSpecKey(key);
    if (VARIATION_LABELS[normalized]) return VARIATION_LABELS[normalized];

    const label = titleizeSpecKey(key);
    if (!label) return 'Variações';
    if (/[sS]$/.test(label)) return label;
    if (/[lL]$/.test(label)) return `${label.slice(0, -1)}is`;
    return `${label}s`;
}

function formatSpecValue(value: unknown): string | null {
    if (value === null || value === undefined || typeof value === 'object') return null;
    const formatted = String(value).trim();
    if (!formatted || formatted === 'no-ram' || formatted === 'no-storage') return null;
    return formatted;
}

function getSpecValue(specs: Record<string, unknown> | undefined, keys: string[]): string {
    for (const key of keys) {
        const value = formatSpecValue(specs?.[key]);
        if (value) return value;
    }
    return '';
}

function getProductBudgetGroupKey(product: any): string {
    const specs = product?.specs || {};
    const ram = getSpecValue(specs, ['ram', 'memoria_ram']);
    const storage = getSpecValue(specs, ['storage', 'armazenamento', 'capacidade', 'memoria', 'memoria_interna', 'memory']);
    const base = product?.model_id || product?.model || product?.name || product?.id || 'produto';
    return [base, ram, storage].map(value => String(value || '').toLowerCase().trim()).join('|');
}

function getBudgetVariantLabel(product: any): string {
    const specs = product?.specs || {};
    const ram = getSpecValue(specs, ['ram', 'memoria_ram']);
    const storage = getSpecValue(specs, ['storage', 'armazenamento', 'capacidade', 'memoria', 'memoria_interna', 'memory']);
    return [ram && `${ram} RAM`, storage].filter(Boolean).join(' / ') || 'Opcao disponivel';
}

function getBudgetVariantSpecLine(product: any): string {
    const specs = product?.specs || {};
    const ram = getSpecValue(specs, ['ram', 'memoria_ram']);
    const storage = getSpecValue(specs, ['storage', 'armazenamento', 'capacidade', 'memoria', 'memoria_interna', 'memory']);
    return [ram, storage].filter(Boolean).join('/') || 'Opcao disponivel';
}

function getBudgetVariantName(product: any): string {
    const name = String(product?.model || product?.name || 'Produto').trim();
    const specLine = getBudgetVariantSpecLine(product);
    if (!specLine || specLine === 'Opcao disponivel') return name;
    return name
        .replace(new RegExp(`,?\\s*${specLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
        .trim() || name;
}

function getBudgetVariantColor(product: any): string {
    return getSpecValue(product?.specs || {}, ['color', 'cor', 'colour']);
}

function buildVariationSummary(rows: Array<{ specs?: Record<string, unknown> }>): VariationSummary {
    const valuesByKey = new Map<string, { originalKey: string; values: Set<string> }>();

    for (const row of rows) {
        const specs = row.specs || {};

        for (const [key, rawValue] of Object.entries(specs)) {
            const normalizedKey = normalizeSpecKey(key);
            if (IGNORED_SPEC_KEYS.has(normalizedKey)) continue;
            if (!ALLOWED_VARIATION_KEYS.has(normalizedKey)) continue;

            const value = formatSpecValue(rawValue);
            if (!value) continue;

            const entry = valuesByKey.get(normalizedKey) || { originalKey: key, values: new Set<string>() };
            entry.values.add(value);
            valuesByKey.set(normalizedKey, entry);
        }
    }

    return Array.from(valuesByKey.entries())
        .map(([normalizedKey, entry]) => ({
            normalizedKey,
            label: pluralizeSpecLabel(entry.originalKey),
            values: Array.from(entry.values),
        }))
        .sort((a, b) => {
            const priority: Record<string, number> = {
                color: 0,
                cor: 0,
                storage: 1,
                memoria: 1,
                memory: 1,
                ram: 2,
            };
            return (priority[a.normalizedKey] ?? 10) - (priority[b.normalizedKey] ?? 10)
                || a.label.localeCompare(b.label, 'pt-BR');
        })
        .map(({ label, values }) => ({ label, values }));
}

/** Fetch distinct available variations of sibling products (same model_id) */
export async function fetchSiblingVariations(product: any): Promise<VariationSummary> {
    const modelId = product.model_id;
    if (!modelId) {
        return buildVariationSummary([{ specs: product.specs || {} }]);
    }

    try {
        const data = await vpsApiService.getProducts({
            model_id: modelId,
            status: 'active',
            limit: 100,
            compact: true,
            noCache: true,
        });

        if (!data) return [];
        const availableProducts = data.filter((row: any) => {
            const stock = row?.stock_quantity ?? row?.stock ?? row?.available_stock;
            return Number(stock || 0) > 0;
        });
        return buildVariationSummary(availableProducts);
    } catch {
        return [];
    }
}

export async function fetchSiblingBudgetVariantGroups(product: any): Promise<BudgetVariantGroup[]> {
    const modelId = product.model_id;
    const rows = modelId
        ? await vpsApiService.getProducts({
            model_id: modelId,
            status: 'active',
            limit: 500,
            compact: true,
            noCache: true,
        }).catch(() => null)
        : null;

    const candidates = (rows && rows.length > 0 ? rows : [product]).filter((row: any) => {
        if (row?.offer_type && row?.offer_visibility === 'hidden') return false;
        if (row?.track_inventory === false) return true;
        const stock = row?.stock_quantity ?? row?.stock ?? row?.available_stock;
        return Number(stock || 0) > 0;
    });

    const currentBaseKey = getProductBudgetGroupKey(product).split('|')[0];
    const groups = new Map<string, BudgetVariantGroup>();

    for (const row of candidates) {
        if (getProductBudgetGroupKey(row).split('|')[0] !== currentBaseKey) continue;
        const key = getProductBudgetGroupKey(row);
        const price = Number(row.price_retail ?? row.price ?? product.price_retail ?? 0) || 0;
        const color = getBudgetVariantColor(row);
        const existing = groups.get(key);
        if (!existing) {
            groups.set(key, {
                key,
                label: getBudgetVariantLabel(row),
                specLine: getBudgetVariantSpecLine(row),
                name: getBudgetVariantName(row),
                price,
                colors: color ? [color] : [],
                products: [row],
            });
            continue;
        }
        existing.products.push(row);
        if (price > 0 && (existing.price <= 0 || price < existing.price)) existing.price = price;
        if (color && !existing.colors.includes(color)) existing.colors.push(color);
    }

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Fetch distinct colors of sibling products (same model_id) */
export async function fetchSiblingColors(product: any): Promise<string[]> {
    const variations = await fetchSiblingVariations(product);
    return variations.find(v => v.label === 'Cores')?.values || [];
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
        '📱 CATÁLOGO - SMARTPHONES',
        `📅 Data: ${formatDate()}`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━',
        '',
    ];

    const categoryRows: Array<{
        name: string;
        specLine: string;
        price: number;
        quantity: number;
        colors: string[];
    }> = [];

    for (const item of items) {
        const { product, unit_price, quantity } = item;

        const budgetVariants = await fetchSiblingBudgetVariantGroups(product);
        if (budgetVariants.length > 0) {
            for (const variant of budgetVariants) {
                categoryRows.push({
                    name: variant.name,
                    specLine: variant.specLine,
                    price: variant.price || unit_price,
                    quantity: 1,
                    colors: variant.colors,
                });
            }
            continue;
        }

        categoryRows.push({
            name: getBudgetVariantName(product),
            specLine: getBudgetVariantSpecLine(product),
            price: unit_price,
            quantity,
            colors: [getBudgetVariantColor(product)].filter(Boolean),
        });
    }

    for (let index = 0; index < categoryRows.length; index += 1) {
        const row = categoryRows[index];
        const total = row.price * row.quantity;
        const plans = await calculateInstallments(total, 12);
        const pixPlan = plans[0];
        const plan12 = plans.find(p => p.installments === 12);
        const qtyLabel = row.quantity > 1 ? ` (${row.quantity}x)` : '';

        lines.push(`${index + 1}. ${row.name}${qtyLabel}`);
        lines.push(`   📱 ${row.specLine}`);
        lines.push(`   💰 ${brl(pixPlan?.total ?? total)} à vista no PIX`);
        if (plan12) {
            lines.push(`   💳 Cartão: 12x de ${brl(plan12.value)} (total ${brl(plan12.total)})`);
        }
        lines.push(`   🎨 Cores: ${row.colors.length > 0 ? row.colors.join(', ') : 'Consultar'}`);
        lines.push('');
    }

    return lines.join('\n').trim();
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
