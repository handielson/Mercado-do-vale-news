import { getCompanyData } from './companyService';
import { supabase } from './supabase';

// API V2 Endpoint Base
const SHOPEE_API_URL = 'https://partner.shopeemobile.com';

/**
 * Utilitário local para assinar URLs e chamadas no lado Cliente/Node
 * Nota: Como estamos no Front-End VITE ou Back-End (se este arquivo for importado na api/),
 * usamos WebCrypto se estiver rolando no browser, mas não podemos usar o 'crypto' do Node.
 * 
 * ATUALIZAÇÃO: Como as integrações de Produtos e Estoque ocorrerão pela própria página Admin,
 * devemos preferir fazer o fetch através de Serverless API (`/api/shopee...`) ou implementar o WebCrypto aqui.
 * 
 * Por padrão, o Front não deveria fazer calls diretas a Shopee expondo o Partner Key, 
 * então toda lógica pesada v2 deve passar por um endpoint Vercel Serverless para segurança do Partner Key.
 * Portanto, este shopeeService vai atuar chamando nossas rotas proprietárias `/api/shopee-actions`.
 */

export const shopeeService = {
    /**
     * Exemplo de chamada pra consultar status da Loja
     * Na vida real, vai bater numa API intermediária (Vercel) para assinar de forma segura.
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
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_stock', product_id: productId, stock: newStock })
            });
            return await res.json();
        } catch (error) {
            console.error("Erro ao atualizar estoque na Shopee", error);
            throw error;
        }
    },

    updatePrice: async (productId: string, retailPriceCentavos: number) => {
        try {
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_price', product_id: productId, price: retailPriceCentavos })
            });
            return await res.json();
        } catch (error) {
            console.error("Erro ao atualizar preço na Shopee", error);
            throw error;
        }
    }
};
