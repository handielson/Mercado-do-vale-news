import { normalizeShopeeConnectionId, PRIMARY_SHOPEE_CONNECTION_ID } from './shopeeConnections';
import { shopeeProductService } from './shopeeProducts';

async function getLinkedShopeeConnectionIds(productId: string): Promise<string[]> {
    const links = await shopeeProductService.getByProductIds([productId]);
    const connectionIds = links
        .filter((link) => Number(link.shopee_item_id) > 0)
        .map((link) => normalizeShopeeConnectionId(link.connection_id));
    return [...new Set(connectionIds.length > 0 ? connectionIds : [PRIMARY_SHOPEE_CONNECTION_ID])];
}

async function postShopeeActionForLinkedStores(
    productId: string,
    action: string,
    payload: Record<string, unknown>,
): Promise<{ connection_id: string; response: any }[]> {
    const connectionIds = await getLinkedShopeeConnectionIds(productId);
    return Promise.all(connectionIds.map(async (connectionId) => {
        const res = await fetch('/api/shopee-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                product_id: productId,
                connection_id: connectionId,
                ...payload,
            }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.error) {
            throw new Error(`${connectionId}: ${data?.message || data?.error || `HTTP ${res.status}`}`);
        }
        return { connection_id: connectionId, response: data };
    }));
}

/**
 * Utilitário local para assinar URLs e chamadas no lado Cliente/Node
 * Nota: Como estamos no Front-End VITE ou Back-End (se este arquivo for importado na api/),
 * usamos WebCrypto se estiver rolando no browser, mas não podemos usar o 'crypto' do Node.
 * 
 * ATUALIZAÇÃO: Como as integrações de Produtos e Estoque ocorrerão pela própria página Admin,
 * devemos preferir fazer o fetch através das rotas VPS (`/api/shopee...`) ou implementar o WebCrypto aqui.
 * 
 * Por padrão, o Front não deveria fazer calls diretas a Shopee expondo o Partner Key, 
 * então toda lógica pesada v2 deve passar por um endpoint da VPS para segurança do Partner Key.
 * Portanto, este shopeeService vai atuar chamando nossas rotas proprietárias `/api/shopee-actions`.
 */

export const shopeeService = {
    /**
     * Exemplo de chamada pra consultar status da Loja
     * Na vida real, vai bater na API intermediária da VPS para assinar de forma segura.
     */
    getShopInfo: async () => {
        try {
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_shop_info' })
            });
            return await res.json();
        } catch (error) {
            console.error("Erro ao buscar Shopee Info", error);
            throw error;
        }
    },

    addProduct: async (productId: string) => {
        try {
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_item', product_id: productId })
            });
            return await res.json();
        } catch (error) {
            console.error("Erro ao enviar produto para a Shopee", error);
            throw error;
        }
    },

    updateStock: async (productId: string, newStock: number) => {
        try {
            return await postShopeeActionForLinkedStores(productId, 'update_stock', { stock: newStock });
        } catch (error) {
            console.error("Erro ao atualizar estoque na Shopee", error);
            throw error;
        }
    },

    updatePrice: async (productId: string, retailPriceCentavos: number) => {
        try {
            return await postShopeeActionForLinkedStores(productId, 'update_price', { price: retailPriceCentavos });
        } catch (error) {
            console.error("Erro ao atualizar preço na Shopee", error);
            throw error;
        }
    }
};
