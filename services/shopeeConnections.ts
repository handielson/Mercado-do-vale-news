import { vpsClient } from './vpsClient';

export interface ShopeeConnection {
    id: string;
    display_name: string;
    shopee_shop_id: string | null;
    authorization_status: 'pending' | 'connected' | string;
    active: boolean;
    connected_at?: string | null;
}

export async function listShopeeConnections(): Promise<ShopeeConnection[]> {
    const data = await vpsClient.get<{ connections?: ShopeeConnection[] }>('/api/shopee-connections');
    return Array.isArray(data?.connections) ? data.connections : [];
}

export async function createShopeeConnection(displayName: string): Promise<ShopeeConnection> {
    const data = await vpsClient.post<{ connection?: ShopeeConnection }>('/api/shopee-connections', {
        display_name: displayName.trim(),
    });
    if (!data?.connection) throw new Error('A conexão Shopee não foi criada.');
    return data.connection;
}
