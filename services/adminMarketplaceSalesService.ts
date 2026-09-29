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
    details?: {
        items?: MarketplaceSaleItem[];
        payment?: string;
        tracking_number?: string;
        shipment_id?: string;
        pack_id?: string;
        [key: string]: unknown;
    };
}

interface SalesResponse {
    sales?: Array<Omit<MarketplaceSale, 'channel' | 'channel_label' | 'normalized_status'> & { channel?: string }>;
    warning?: string;
}

export interface MarketplaceSalesResult {
    sales: MarketplaceSale[];
    warnings: string[];
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
    })).filter((sale) => sale.external_id && sale.occurred_at);
}

export async function getMarketplaceSales(filters: { start_date?: string; end_date?: string } = {}): Promise<MarketplaceSalesResult> {
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
    const requests: Array<{ label: string; channel: MarketplaceSalesChannel; promise: Promise<SalesResponse> }> = [
        {
            label: 'Shopee MV',
            channel: 'shopee_mv',
            promise: vpsClient.get<SalesResponse>(`/admin/mobile-sales?${queryString(filters, { channel: 'shopee', connection_id: PRIMARY_SHOPEE_CONNECTION_ID })}`),
        },
        ...secondaryConnections.map((connection, index) => ({
            label: index === 0 ? 'Shopee G' : `Shopee ${connection.display_name}`,
            channel: 'shopee_g' as const,
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
        sales.push(...mapSales(result.value, request.channel, request.label));
        if (result.value.warning) warnings.push(`${request.label}: ${result.value.warning}`);
    });
    sales.sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
    return { sales, warnings };
}
