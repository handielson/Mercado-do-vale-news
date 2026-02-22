import { SupabaseClient } from '@supabase/supabase-js';
import { SystemTag } from './systemTagsService';

// ============================================================
// Tag Resolver — Motor de resolução de variáveis dinâmicas
// Funciona tanto no cliente (Supabase SDK) quanto no servidor.
// ============================================================

const fmtMoney = (val: number) =>
    `R$ ${val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const fmtDate = (now: Date, format: string): string => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    });
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
    if (format === 'time') return timeFormatter.format(now);
    if (format === 'datetime') return `${formatter.format(now)} ${timeFormatter.format(now)}`;
    return formatter.format(now); // default: 'date'
};

// Substitui variáveis de linha no list_products
const applyLineFormat = (template: string, row: Record<string, string>): string => {
    let line = template;
    Object.entries(row).forEach(([k, v]) => {
        line = line.split(`{${k}}`).join(v ?? '');
    });
    return line;
};

/**
 * Resolve uma única tag com base no resolver_type.
 * Requer uma instância do Supabase Client (pode ser service role no backend).
 */
export async function resolveTag(tag: SystemTag, supabase: SupabaseClient): Promise<string> {
    const cfg = tag.resolver_config || {};
    const now = new Date();

    try {
        switch (tag.resolver_type) {
            // ── STATIC ──────────────────────────────────────────
            case 'static':
                return cfg.value ?? '';

            // ── DATE ────────────────────────────────────────────
            case 'date_now':
                return fmtDate(now, cfg.format ?? 'date');

            // ── COUNT PRODUCTS ───────────────────────────────────
            case 'count_products': {
                let query = supabase.from('products').select('id', { count: 'exact', head: true });
                if (cfg.status) query = query.eq('status', cfg.status);
                if (cfg.min_stock != null) query = query.gt('stock_quantity', cfg.min_stock - 1);
                // category_slug filter via name heuristic if no FK
                const { count } = await query;
                return (count ?? 0).toString();
            }

            // ── SUM STOCK ────────────────────────────────────────
            case 'sum_products_stock': {
                let query = supabase.from('products').select('stock_quantity');
                if (cfg.status) query = query.eq('status', cfg.status);
                const { data } = await query;
                const total = (data ?? []).reduce((s: number, p: any) => s + (p.stock_quantity || 0), 0);
                return total.toString();
            }

            // ── LIST PRODUCTS ────────────────────────────────────
            case 'list_products': {
                const limit = cfg.limit ?? 30;
                const fmt = cfg.format ?? '• {qty}x - {name} - {color} - {ram}/{storage}';

                let query = supabase
                    .from('products')
                    .select('name, stock_quantity, specs, price_pix, price_card, category_id')
                    .eq('status', 'active')
                    .gt('stock_quantity', 0)
                    .limit(limit * 3); // fetch more to allow grouping

                const { data: products } = await query;
                if (!products || products.length === 0) return 'Nenhum item em estoque.';

                // Filter by category_slug heuristic in name
                const categorySlug = cfg.category_slug ?? '';
                const CELULAR_KEYWORDS = ['iphone', 'samsung', 'xiaomi', 'motorola', 'galaxy',
                    'poco', 'redmi', 'smartphone', 'celular'];

                let filtered = products;
                if (categorySlug === 'celulares') {
                    filtered = products.filter((p: any) =>
                        CELULAR_KEYWORDS.some(k => p.name.toLowerCase().includes(k))
                    );
                }

                // Group by name + color + ram + storage
                const grouped = new Map<string, { qty: number; p: any }>();
                filtered.forEach((p: any) => {
                    const color = p.specs?.color || p.specs?.cor || '';
                    const ram = p.specs?.ram || '';
                    const storage = p.specs?.storage || '';
                    const key = `${p.name}||${color}||${ram}||${storage}`;
                    const existing = grouped.get(key);
                    if (existing) {
                        existing.qty += p.stock_quantity || 0;
                    } else {
                        grouped.set(key, { qty: p.stock_quantity || 0, p });
                    }
                });

                // Sort by qty desc
                const sorted = Array.from(grouped.values())
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, limit);

                // Format each line
                const lines = sorted.map(({ qty, p }) => {
                    const color = p.specs?.color || p.specs?.cor || '';
                    const ram = p.specs?.ram || '';
                    const storage = p.specs?.storage || '';
                    const avgPrice = p.price_pix ? fmtMoney(p.price_pix / 100) : '';
                    const pricePix = p.price_pix ? fmtMoney(p.price_pix / 100) : '';
                    const priceCard = p.price_card ? fmtMoney(p.price_card / 100) : '';

                    return applyLineFormat(fmt, {
                        qty: qty.toString(),
                        name: p.name,
                        color,
                        ram,
                        storage,
                        avg_price: avgPrice,
                        price_pix: pricePix,
                        price_card: priceCard,
                    });
                });

                return lines.length > 0 ? lines.join('\n') : 'Nenhum item em estoque.';
            }

            // ── COUNT SALES TODAY ────────────────────────────────
            case 'count_sales_today': {
                const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setHours(23, 59, 59, 999);

                let query = supabase.from('sales')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());
                if (cfg.status) query = query.eq('status', cfg.status);

                const { count } = await query;
                return (count ?? 0).toString();
            }

            // ── SUM SALES TODAY ──────────────────────────────────
            case 'sum_sales_today': {
                const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setHours(23, 59, 59, 999);

                const field = cfg.field ?? 'total';
                let query = supabase.from('sales')
                    .select(field)
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString());
                if (cfg.status) query = query.eq('status', cfg.status);

                const { data } = await query;
                const sum = (data ?? []).reduce((s: number, r: any) => s + (r[field] || 0), 0);
                return fmtMoney(sum);
            }

            // ── SYSTEM INJECTED (read-only, não resolvida pelo motor) ─
            case 'system_injected':
                return tag.preview_value ?? `{${tag.name}}`;

            default:
                return `{${tag.name}}`;
        }
    } catch {
        return tag.preview_value || `{${tag.name}}`;
    }
}

/**
 * Resolve todas as tags computáveis (não system_injected) e retorna um dicionário.
 * Uso: const dict = await resolveAll(tags, supabase)
 *      msg = applyDict(msg, dict)
 */
export async function resolveAll(
    tags: SystemTag[],
    supabase: SupabaseClient
): Promise<Record<string, string>> {
    const resolvable = tags.filter(t => t.active && t.resolver_type !== 'system_injected');
    const entries = await Promise.all(
        resolvable.map(async t => [`{${t.name}}`, await resolveTag(t, supabase)] as [string, string])
    );
    return Object.fromEntries(entries);
}

/**
 * Aplica um dicionário de substituição em um texto.
 */
export function applyDict(text: string, dict: Record<string, string>): string {
    let result = text;
    Object.entries(dict).forEach(([key, value]) => {
        result = result.split(key).join(value);
    });
    return result;
}
