/**
 * productNormalizer.ts
 *
 * Converte qualquer objeto de produto (VPS MySQL, formato legado, Bling)
 * para o formato canônico VPS — eliminando bugs de campo com nomes diferentes.
 *
 * ─── POR QUE ISSO EXISTE? ────────────────────────────────────────────────────
 *   Campo          VPS MySQL         formato legado      Bling API
 *   ──────────     ────────────      ───────────────      ─────────────────
 *   Preço varejo   price_retail      price                precoVenda
 *   Código barras  ean               barcode              gtin
 *   Estoque        stock_quantity    stock                saldoFisicoTotal
 *   Status         status (string)   active (boolean)     situacao
 *
 * Use normalizeProduct() sempre antes de lógica de negócio ou sync.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { toBrowserSafeMediaUrl } from '@/utils/media-url';

export interface NormalizedProduct {
  id: string;
  sku: string;
  ean: string;                    // nunca 'barcode'
  name: string;
  slug?: string;
  status: 'active' | 'inactive'; // nunca booleano

  // Preços — sempre prefixo price_*
  price_retail: number;           // nunca 'price', 'preco', 'precoVenda'
  price_cost?: number;
  price_reseller?: number;
  price_wholesale?: number;
  price_promo?: number | null;
  promo_start?: string | null;
  promo_end?: string | null;

  // Estoque
  stock_quantity: number;         // nunca 'stock'
  track_inventory: boolean;

  // Mídia
  images: string[];
  image_url: string | null;       // sempre derivado de images[0]
  video_url?: string | null;

  // Relacionamentos
  category_id?: string;
  brand?: string;
  model_id?: string;
  parent_id?: string | null;

  // Conteúdo
  description?: string;
  specs?: Record<string, unknown>;
  custom_fields?: Record<string, unknown>;

  // Dimensões
  weight_g?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;

  // Integração Bling
  bling_id?: string;
  bling_parent_id?: string;

  [key: string]: unknown;
}

function normalizeTrackInventory(value: unknown, stockRaw: unknown): boolean {
  if (value !== undefined && value !== null) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;

    const normalized = String(value).trim().toLowerCase();
    if (['0', 'false', 'nao', 'não', 'no', 'null', 'undefined', ''].includes(normalized)) return false;
    if (['1', 'true', 'sim', 'yes'].includes(normalized)) return true;
  }

  return stockRaw !== null && stockRaw !== undefined && String(stockRaw).toLowerCase() !== 'null';
}

export function normalizeProduct(p: Record<string, any>): NormalizedProduct {
  // ── Status ─────────────────────────────────────────────────────────────────
  // VPS: 'active' | 'inactive' | 'ativo' | 'a' | 'disponível' | 'disponivel'
  // VPS: active = true | false
  let status: 'active' | 'inactive';
  if (typeof p.status === 'string') {
    const s = p.status.toLowerCase().trim();
    status = (s === 'active' || s === 'ativo' || s === 'a' || s === 'disponível' || s === 'disponivel')
      ? 'active'
      : 'inactive';
  } else if (typeof p.active === 'boolean') {
    status = p.active ? 'active' : 'inactive'; // Formato legado usa booleano
  } else {
    status = 'active'; // fallback seguro
  }

  // ── EAN ─────────────────────────────────────────────────────────────────────
  // VPS = ean, Legado = barcode, Bling = gtin
  const ean = String(p.ean || p.barcode || p.gtin || '');

  // ── Preço de venda ──────────────────────────────────────────────────────────
  // VPS = price_retail, Legado = price, Bling = precoVenda / preco_venda / preco_varejo
  const rawPrice = p.price_retail ?? p.price ?? p.preco ?? p.preco_venda ?? p.preco_varejo ?? p.precoVenda ?? null;
  const price_retail = rawPrice !== null && rawPrice !== undefined
    ? (isNaN(parseFloat(String(rawPrice))) ? 0 : parseFloat(String(rawPrice)))
    : 0;

  // ── Estoque ─────────────────────────────────────────────────────────────────
  // VPS = stock_quantity, Legado = stock
  const stockRaw = p.stock_quantity !== undefined ? p.stock_quantity : p.stock;
  let stock_quantity = 0;
  if (typeof stockRaw === 'number') {
    stock_quantity = stockRaw;
  } else if (typeof stockRaw === 'string' && stockRaw.trim() && stockRaw.toLowerCase() !== 'null') {
    stock_quantity = parseInt(stockRaw, 10) || 0;
  }

  // ── Track inventory ─────────────────────────────────────────────────────────
  const track_inventory = normalizeTrackInventory(p.track_inventory, stockRaw);

  // ── Imagens ─────────────────────────────────────────────────────────────────
  // VPS pode retornar como array, string JSON ou até uma URL única em string.
  let images: string[] = [];
  if (Array.isArray(p.images)) {
    images = p.images
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => toBrowserSafeMediaUrl(value));
  } else if (typeof p.images === 'string' && p.images.trim()) {
    const rawImages = p.images.trim();

    if (rawImages.startsWith('[')) {
      try {
        const parsed = JSON.parse(rawImages);
        if (Array.isArray(parsed)) {
          images = parsed
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => toBrowserSafeMediaUrl(value));
        }
      } catch {
        images = [];
      }
    } else {
      images = [toBrowserSafeMediaUrl(rawImages)];
    }
  }

  const fallbackImageUrl = typeof p.image_url === 'string' && p.image_url.trim()
    ? toBrowserSafeMediaUrl(p.image_url.trim())
    : null;

  if (images.length === 0 && fallbackImageUrl) {
    images = [fallbackImageUrl];
  }

  const image_url = images.length > 0 ? images[0] : fallbackImageUrl;

  return {
    ...p, // preserva campos extras sem perder dados

    // Campos normalizados (sobrescrevem os raw)
    id: String(p.id || ''),
    sku: String(p.sku || ''),
    ean,
    name: String(p.name || ''),
    // Nao inventa slug no frontend: se a VPS ainda nao persistiu slug,
    // a navegacao deve cair para o id real do produto.
    slug: (typeof p.slug === 'string' && p.slug.trim()) ? p.slug : undefined,
    status,
    price_retail,
    price_cost: p.price_cost !== undefined ? parseFloat(String(p.price_cost)) || 0 : undefined,
    price_reseller: p.price_reseller !== undefined ? parseFloat(String(p.price_reseller)) || 0 : undefined,
    price_wholesale: p.price_wholesale !== undefined ? parseFloat(String(p.price_wholesale)) || 0 : undefined,
    price_promo: p.price_promo != null ? parseFloat(String(p.price_promo)) || null : null,
    promo_start: p.promo_start ?? null,
    promo_end: p.promo_end ?? null,
    stock_quantity,
    track_inventory,
    images,
    image_url,
    video_url: p.video_url ? toBrowserSafeMediaUrl(p.video_url) : null,
    category_id: p.category_id,
    brand: p.brand,
    model_id: p.model_id,
    parent_id: p.parent_id ?? null,
    description: p.description,
    specs: p.specs ?? {},
    custom_fields: p.custom_fields ?? {},
    bling_id: p.bling_id,
    bling_parent_id: p.bling_parent_id,
  };
}

/**
 * Normaliza um array de produtos.
 */
export function normalizeProducts(products: Record<string, any>[]): NormalizedProduct[] {
  return products.map(normalizeProduct);
}

/**
 * Converte produto normalizado (VPS) para formato formato legado.
 * @deprecated Use apenas em scripts de migração — nunca no frontend.
 */
export function toLegacyProductFormat(p: NormalizedProduct): Record<string, unknown> {
  return {
    ...p,
    price: p.price_retail,         // Formato legado usa 'price'
    barcode: p.ean,                // Formato legado usa 'barcode'
    stock: p.stock_quantity,       // Formato legado usa 'stock'
    active: p.status === 'active', // Formato legado usa booleano
    price_retail: undefined,
    ean: undefined,
    stock_quantity: undefined,
    status: undefined,
  };
}
