import { vpsClient } from './vpsClient';
import { listShopeeConnections, PRIMARY_SHOPEE_CONNECTION_ID } from './shopeeConnections';

export type MarketplaceSalesChannel = 'shopee_mv' | 'shopee_g' | 'mercado_livre' | 'tiktok';
export type MarketplaceSaleStatus = 'completed' | 'pending' | 'cancelled' | 'refunded';

export interface MarketplaceSaleItem {
    name: string;
    sku?: string;
    variation?: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
    image_url?: string;
}

export interface MarketplaceFinancialLine {
    key: string;
    label: string;
    amount_cents: number;
}

export interface MarketplaceFinancialCostItem {
    name: string;
    variation?: string;
    sku?: string;
    quantity: number;
    product_id: string | null;
    product_name: string | null;
    matched_by: 'shopee_link' | 'sku' | null;
    unit_cost_cents: number;
    total_cost_cents: number;
    current_cost_cents?: number | null;
    cost_basis?: string | null;
    cost_editable?: boolean;
    cost_lock_reason?: string | null;
}

export interface MarketplaceSaleFinancial {
    source: 'shopee_escrow';
    state: 'final' | 'estimated' | 'cancelled' | 'unavailable';
    note?: string;
    product_revenue_cents?: number;
    buyer_paid_cents?: number | null;
    revenue_lines?: MarketplaceFinancialLine[];
    fee_lines?: MarketplaceFinancialLine[];
    marketplace_deductions_cents?: number;
    marketplace_deductions_pct?: number | null;
    payout_cents?: number | null;
    cost?: {
        total_cents: number;
        complete: boolean;
        missing_count: number;
        items: MarketplaceFinancialCostItem[];
    };
    profit_cents?: number | null;
    margin_pct?: number | null;
    raw_fields?: MarketplaceFinancialLine[];
}

export interface MarketplaceSale {
    channel: MarketplaceSalesChannel;
    channel_label: string;
    external_id: string;
    display_id?: string;
    status: string;
    normalized_status: MarketplaceSaleStatus;
    customer_name: string;
    total_cents: number;
    currency: string;
    occurred_at: string;
    connection_id?: string;
    details?: {
        items?: MarketplaceSaleItem[];
        payment?: string;
        tracking_number?: string;
        shipment_id?: string;
        pack_id?: string;
        financial?: MarketplaceSaleFinancial;
        [key: string]: unknown;
    };
}

const MARKETPLACE_STATUS_LABELS: Record<string, string> = {
    PAID: 'Pago',
    PARTIALLY_PAID: 'Pago parcialmente',
    PAYMENT_REQUIRED: 'Aguardando pagamento',
    PAYMENT_IN_PROCESS: 'Pagamento em processamento',
    PARTIALLY_REFUNDED: 'Reembolsado parcialmente',
    REFUNDED: 'Reembolsado',
    PENDING_CANCEL: 'Cancelamento pendente',
    INVALID: 'Pedido inválido',
    UNPAID: 'Aguardando pagamento',
    TO_CONFIRM_RECEIVE: 'Aguardando recebimento',
    READY_TO_SHIP: 'Aguardando envio',
    PROCESSED: 'Pedido processado',
    RETRY_SHIP: 'Reenvio necessário',
    SHIPPED: 'Enviado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    IN_CANCEL: 'Cancelamento solicitado',
    PAYMENT_FAILED: 'Pagamento recusado',
    CONFIRMED: 'Pagamento confirmado',
};

export function formatMarketplaceStatus(status: unknown): string {
    const raw = String(status || '').trim();
    if (!raw) return 'Situação não informada';
    return MARKETPLACE_STATUS_LABELS[raw.toUpperCase()] || raw;
}

interface SalesResponse {
    sales?: Array<Omit<MarketplaceSale, 'channel' | 'channel_label' | 'normalized_status'> & { channel?: string }>;
    warning?: string;
}

export interface MarketplaceSalesResult {
    sales: MarketplaceSale[];
    warnings: string[];
}

// marketplace-sales-local-first-v1: a lista abre com o que ja esta salvo neste navegador
// e depois busca na VPS somente o que mudou (changed_since). A VPS le do proprio MySQL;
// as APIs de Shopee/TikTok/Mercado Livre so sao consultadas pela sincronizacao em segundo plano.
const MARKETPLACE_SALES_CACHE_PREFIX = 'mdv:marketplace-sales:v2:';

interface MarketplaceSalesCacheEntry {
    savedAt: number;
    serverTime: string;
    result: MarketplaceSalesResult;
}

interface StoredSalesResponse {
    sales?: Array<Record<string, unknown> & { source_channel?: string; connection_id?: string }>;
    server_time?: string;
    syncing?: boolean;
    sources?: Array<{
        channel: string;
        connection_id?: string;
        label?: string;
        initial_sync_done?: boolean;
        last_error?: string | null;
    }>;
}

function marketplaceSalesCacheKey(filters: { start_date?: string; end_date?: string }): string {
    return `${MARKETPLACE_SALES_CACHE_PREFIX}${filters.start_date || ''}:${filters.end_date || ''}`;
}

function readMarketplaceSalesCache(filters: { start_date?: string; end_date?: string }): MarketplaceSalesCacheEntry | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(marketplaceSalesCacheKey(filters));
        const cached = raw ? JSON.parse(raw) as MarketplaceSalesCacheEntry : null;
        if (!cached || !Array.isArray(cached.result?.sales) || !cached.serverTime) return null;
        return cached;
    } catch {
        return null;
    }
}

export function getCachedMarketplaceSales(filters: { start_date?: string; end_date?: string } = {}): MarketplaceSalesResult | null {
    return readMarketplaceSalesCache(filters)?.result || null;
}

function cacheMarketplaceSales(filters: { start_date?: string; end_date?: string }, result: MarketplaceSalesResult, serverTime: string): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(marketplaceSalesCacheKey(filters), JSON.stringify({ savedAt: Date.now(), serverTime, result } satisfies MarketplaceSalesCacheEntry));
    } catch {
        // Sem espaco ou armazenamento bloqueado: a lista continua vindo da VPS.
    }
}

function normalizeStatus(value: unknown): MarketplaceSaleStatus {
    const status = String(value || '').trim().toUpperCase();
    if (/CANCEL|CANCELED/.test(status)) return 'cancelled';
    if (/REFUND|RETURN/.test(status)) return 'refunded';
    if (/UNPAID|PAYMENT_REQUIRED|PAYMENT_IN_PROCESS|PENDING_PAYMENT|CONFIRMED/.test(status)) return 'pending';
    return 'completed';
}

function mapSales(
    response: SalesResponse,
    channel: MarketplaceSalesChannel,
    channelLabel: string,
    connectionId?: string,
): MarketplaceSale[] {
    return (Array.isArray(response?.sales) ? response.sales : []).map((sale) => ({
        ...sale,
        channel,
        channel_label: channelLabel,
        normalized_status: normalizeStatus(sale.status),
        external_id: String(sale.external_id || ''),
        customer_name: String(sale.customer_name || channelLabel),
        total_cents: Number(sale.total_cents) || 0,
        currency: String(sale.currency || 'BRL'),
        occurred_at: String(sale.occurred_at || ''),
        connection_id: connectionId,
    })).filter((sale) => sale.external_id && sale.occurred_at);
}

function marketplaceSaleKey(sale: Pick<MarketplaceSale, 'channel' | 'connection_id' | 'external_id'>): string {
    return `${sale.channel}|${sale.connection_id || ''}|${sale.external_id}`;
}

export function mergeMarketplaceSales(current: MarketplaceSale[], incoming: MarketplaceSale[]): MarketplaceSale[] {
    const byKey = new Map(current.map((sale) => [marketplaceSaleKey(sale), sale]));
    for (const sale of incoming) byKey.set(marketplaceSaleKey(sale), sale);
    return [...byKey.values()].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
}

async function channelResolver(): Promise<(source: string, connectionId?: string) => { channel: MarketplaceSalesChannel; label: string; connectionId?: string } | null> {
    const connections = await listShopeeConnections().catch(() => []);
    const secondary = connections.filter((connection) => (
        connection.active !== false
        && connection.authorization_status === 'connected'
        && connection.shopee_shop_id
    ));
    return (source, connectionId) => {
        if (source === 'mercado_livre') return { channel: 'mercado_livre', label: 'Mercado Livre' };
        if (source === 'tiktok') return { channel: 'tiktok', label: 'TikTok Shop' };
        if (source !== 'shopee') return null;
        if (!connectionId || connectionId === PRIMARY_SHOPEE_CONNECTION_ID) {
            return { channel: 'shopee_mv', label: 'Shopee MV', connectionId: PRIMARY_SHOPEE_CONNECTION_ID };
        }
        const index = secondary.findIndex((connection) => connection.id === connectionId);
        const connection = secondary[index];
        return {
            channel: 'shopee_g',
            label: index <= 0 ? 'Shopee G' : `Shopee ${connection?.display_name || ''}`.trim(),
            connectionId,
        };
    };
}

export async function getMarketplaceSales(filters: { start_date?: string; end_date?: string } = {}, options: { force?: boolean } = {}): Promise<MarketplaceSalesResult> {
    if (options.force) {
        // Pede uma sincronizacao imediata (a VPS espera no maximo ~20 s) antes de ler o delta.
        await vpsClient.post('/admin/marketplace-sales/sync', {}).catch(() => null);
    }
    const cached = readMarketplaceSalesCache(filters);
    const query = new URLSearchParams();
    if (filters.start_date) query.set('start_date', filters.start_date);
    if (filters.end_date) query.set('end_date', filters.end_date);
    if (cached?.serverTime) query.set('changed_since', cached.serverTime);
    const [response, resolve] = await Promise.all([
        vpsClient.get<StoredSalesResponse>(`/admin/marketplace-sales?${query.toString()}`, { timeoutMs: 30_000 }),
        channelResolver(),
    ]);

    const grouped = new Map<string, { info: NonNullable<ReturnType<typeof resolve>>; sales: NonNullable<SalesResponse['sales']> }>();
    for (const sale of Array.isArray(response?.sales) ? response.sales : []) {
        const info = resolve(String(sale.source_channel || ''), sale.connection_id ? String(sale.connection_id) : undefined);
        if (!info) continue;
        const key = `${info.channel}|${info.connectionId || ''}|${info.label}`;
        if (!grouped.has(key)) grouped.set(key, { info, sales: [] });
        grouped.get(key)!.sales.push(sale as never);
    }
    const incoming: MarketplaceSale[] = [];
    for (const { info, sales } of grouped.values()) {
        incoming.push(...mapSales({ sales }, info.channel, info.label, info.connectionId));
    }

    const warnings: string[] = [];
    for (const source of Array.isArray(response?.sources) ? response.sources : []) {
        const info = resolve(source.channel, source.connection_id);
        const label = info?.label || source.label || source.channel;
        if (source.last_error) warnings.push(`${label}: ${source.last_error}`);
        else if (!source.initial_sync_done) warnings.push(`${label}: carregando o histórico pela primeira vez`);
    }

    const sales = mergeMarketplaceSales(cached?.result.sales || [], incoming);
    const result = { sales, warnings };
    cacheMarketplaceSales(filters, result, String(response?.server_time || cached?.serverTime || ''));
    return result;
}

export async function getMarketplaceSaleDetail(sale: MarketplaceSale): Promise<MarketplaceSale> {
    if (!['shopee_mv', 'shopee_g', 'tiktok'].includes(sale.channel)) return sale;
    const apiChannel = sale.channel.startsWith('shopee') ? 'shopee' : 'tiktok';
    const query = sale.connection_id ? `?connection_id=${encodeURIComponent(sale.connection_id)}` : '';
    const response = await vpsClient.get<{ sale?: Omit<MarketplaceSale, 'channel' | 'channel_label' | 'normalized_status'> }>(
        `/admin/mobile-sales/${apiChannel}/${encodeURIComponent(sale.external_id)}${query}`,
    );
    const refreshed = mapSales({ sales: response?.sale ? [response.sale] : [] }, sale.channel, sale.channel_label, sale.connection_id)[0];
    return refreshed || sale;
}

export interface ManualCostUpdateInput {
    cost_cents: number;
    expected_cost_cents: number | null;
    note?: string;
    context?: string;
}

/** Ajusta o custo de compra do produto (sem Bling). A API registra quem, quando, valor anterior e motivo. */
export async function updateProductManualCost(productId: string, input: ManualCostUpdateInput): Promise<{ ok: boolean; product: { id: string; price_cost: number } }> {
    return vpsClient.patch(`/admin/products/${encodeURIComponent(productId)}/cost`, input);
}
