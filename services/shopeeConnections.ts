import { vpsClient } from './vpsClient';

export interface ShopeeConnection {
    id: string;
    display_name: string;
    seller_type?: 'individual' | 'business' | string;
    shopee_shop_id: string | null;
    authorization_status: 'pending' | 'connected' | string;
    active: boolean;
    connected_at?: string | null;
}

export const PRIMARY_SHOPEE_CONNECTION_ID = 'primary';

export function normalizeShopeeConnectionId(value?: string | null): string {
    const normalized = String(value || '').trim();
    return normalized || PRIMARY_SHOPEE_CONNECTION_ID;
}

export function withShopeeConnection(url: string, connectionId?: string | null): string {
    const normalized = normalizeShopeeConnectionId(connectionId);
    if (normalized === PRIMARY_SHOPEE_CONNECTION_ID) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_id=${encodeURIComponent(normalized)}`;
}

export async function listShopeeConnections(): Promise<ShopeeConnection[]> {
    const data = await vpsClient.get<{ connections?: ShopeeConnection[] }>('/shopee-connections');
    return Array.isArray(data?.connections) ? data.connections : [];
}

export async function createShopeeConnection(displayName: string): Promise<ShopeeConnection> {
    const data = await vpsClient.post<{ connection?: ShopeeConnection }>('/shopee-connections', {
        display_name: displayName.trim(),
    });
    if (!data?.connection) throw new Error('A conexão Shopee não foi criada.');
    return data.connection;
}
