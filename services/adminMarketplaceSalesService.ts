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

const MARKETPLACE_SALES_CACHE_PREFIX = 'mdv:marketplace-sales:v1:';
const MARKETPLACE_SALES_CACHE_TTL_MS = 5 * 60 * 1000;

interface MarketplaceSalesCacheEntry {
    savedAt: number;
    result: MarketplaceSalesResult;
}

function marketplaceSalesCacheKey(filters: { start_date?: string; end_date?: string }): string {
    return `${MARKETPLACE_SALES_CACHE_PREFIX}${filters.start_date || ''}:${filters.end_date || ''}`;
}

export function getCachedMarketplaceSales(filters: { start_date?: string; end_date?: string } = {}): MarketplaceSalesResult | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(marketplaceSalesCacheKey(filters));
        const cached = raw ? JSON.parse(raw) as MarketplaceSalesCacheEntry : null;
        if (!cached || Date.now() - Number(cached.savedAt) > MARKETPLACE_SALES_CACHE_TTL_MS || !Array.isArray(cached.result?.sales)) return null;
        return cached.result;
    } catch {
        return null;
    }
}

function cacheMarketplaceSales(filters: { start_date?: string; end_date?: string }, result: MarketplaceSalesResult): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(marketplaceSalesCacheKey(filters), JSON.stringify({ savedAt: Date.now(), result } satisfies MarketplaceSalesCacheEntry));
    } catch {
        // A listagem continua funcionando quando o navegador bloqueia o armazenamento local.
    }
}

function normalizeStatus(value: unknown): MarketplaceSaleStatus {
    const status = String(value || '').trim().toUpperCase();
    if (/CANCEL|CANCELED/.test(status)) return 'cancelled';
    if (/REFUND|RETURN/.test(status)) return 'refunded';
    if (/UNPAID|PAYMENT_REQUIRED|PAYMENT_IN_PROCESS|PENDING_PAYMENT|CONFIRMED/.test(status)) return 'pending';
    return 'completed';
}

function queryString(filters: { start_date?: string; end_date?: string }, extra: Record<string, string> = {}): string {
    const query = new URLSearchParams({ limit: '500', ...extra });
    if (filters.start_date) query.set('start_date', filters.start_date);
    if (filters.end_date) query.set('end_date', filters.end_date);
    return query.toString();
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

export async function getMarketplaceSales(filters: { start_date?: string; end_date?: string } = {}, options: { force?: boolean } = {}): Promise<MarketplaceSalesResult> {
    const cached = !options.force ? getCachedMarketplaceSales(filters) : null;
    if (cached) return cached;
    let connectionLoadFailed = false;
    const connections = await listShopeeConnections().catch(() => {
        connectionLoadFailed = true;
        return [];
    });
    const secondaryConnections = connections.filter((connection) => (
        connection.active !== false
        && connection.authorization_status === 'connected'
        && connection.shopee_shop_id
    ));
    const requests: Array<{ label: string; channel: MarketplaceSalesChannel; connectionId?: string; promise: Promise<SalesResponse> }> = [
        {
            label: 'Shopee MV',
            channel: 'shopee_mv',
            connectionId: PRIMARY_SHOPEE_CONNECTION_ID,
            promise: vpsClient.get<SalesResponse>(`/admin/mobile-sales?${queryString(filters, { channel: 'shopee', connection_id: PRIMARY_SHOPEE_CONNECTION_ID })}`),
        },
        ...secondaryConnections.map((connection, index) => ({
            label: index === 0 ? 'Shopee G' : `Shopee ${connection.display_name}`,
            channel: 'shopee_g' as const,
            connectionId: connection.id,
            promise: vpsClient.get<SalesResponse>(`/admin/mobile-sales?${queryString(filters, { channel: 'shopee', connection_id: connection.id })}`),
        })),
        {
            label: 'Mercado Livre',
            channel: 'mercado_livre',
            promise: vpsClient.get<SalesResponse>(`/mercado-livre/orders?${queryString(filters)}`),
        },
        {
            label: 'TikTok Shop',
            channel: 'tiktok',
            promise: vpsClient.get<SalesResponse>(`/admin/mobile-sales?${queryString(filters, { channel: 'tiktok' })}`),
        },
    ];

    const results = await Promise.allSettled(requests.map((request) => request.promise));
    const sales: MarketplaceSale[] = [];
    const warnings: string[] = connectionLoadFailed ? ['Shopee G: não foi possível consultar as conexões'] : [];
    results.forEach((result, index) => {
        const request = requests[index];
        if (result.status === 'rejected') {
            warnings.push(`${request.label} indisponível`);
            return;
        }
        sales.push(...mapSales(result.value, request.channel, request.label, request.connectionId));
        if (result.value.warning) warnings.push(`${request.label}: ${result.value.warning}`);
    });
    sales.sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
    const result = { sales, warnings };
    cacheMarketplaceSales(filters, result);
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
