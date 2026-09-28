import { vpsClient } from './vpsClient';
import type { CatalogProduct } from '@/types/catalog';

export type StorefrontCode = 'mercado_do_vale' | 'loja_3d';
export type StorefrontPublicationStatus = 'draft' | 'published' | 'hidden';
export type Print3dQuote = {
  storefront: 'loja_3d';
  items: Array<{ product_id: string; sku?: string; name?: string; quantity: number; ready_quantity?: number;
    preorder_quantity?: number; production_days?: number | null; unit_price?: number; subtotal?: number;
    status: 'available' | 'requires_consultation' | 'unavailable' }>;
  subtotal: number | null;
  payment_schedule: {
    subtotal: number;
    ready_amount: number;
    preorder_amount: number;
    deposit_amount: number;
    due_on_confirmation: number;
    due_before_shipping: number;
    shipping_cost_included: false;
  } | null;
  can_checkout: false;
  notice: string;
};
export type StorefrontOffer = {
  product_id?: string;
  storefront: StorefrontCode;
  publication_status: StorefrontPublicationStatus;
  title: string | null;
  description: string | null;
  category_label: string | null;
  slug: string | null;
  price_retail: number | null;
  price_reseller: number | null;
  price_wholesale: number | null;
  price_promo: number | null;
  meta_title: string | null;
  meta_description: string | null;
};

export const productStorefrontOffersService = {
  async publicProductIds(storefront: StorefrontCode): Promise<Set<string>> {
    const ids = new Set<string>();
    for (let offset = 0; ; offset += 500) {
      const page = await vpsClient.get<CatalogProduct[]>(`/storefronts/${storefront}/products?limit=500&offset=${offset}&compact=true`);
      for (const product of page) ids.add(product.id);
      if (page.length < 500) return ids;
    }
  },
  list: (productId: string) => vpsClient.get<{ offers: StorefrontOffer[] }>(
    `/admin/products/${encodeURIComponent(productId)}/storefront-offers`
  ),
  save: (productId: string, offer: StorefrontOffer) => vpsClient.put<StorefrontOffer & { ok: boolean }>(
    `/admin/products/${encodeURIComponent(productId)}/storefront-offers/${offer.storefront}`, offer
  ),
  publicProducts: (storefront: StorefrontCode, limit = 2000) => vpsClient.get<CatalogProduct[]>(
    `/storefronts/${storefront}/products?limit=${limit}`
  ),
  publicProduct: (storefront: StorefrontCode, productId: string) => vpsClient.get<CatalogProduct>(
    `/storefronts/${storefront}/products/${encodeURIComponent(productId)}`
  ),
  quotePrint3d: (items: Array<{ product_id: string; quantity: number }>) => vpsClient.post<Print3dQuote>(
    '/storefronts/loja_3d/quote', { items }
  ),
};
