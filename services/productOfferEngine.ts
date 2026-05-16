import type {
  ProductOfferComponent,
  ProductOfferProductLike,
  ProductOfferShopeeStrategy,
  ProductOfferType,
} from '../types/product-offer';

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function slugPart(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function codePart(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

function positiveInt(value: unknown, fallback = 0): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_OFFER_SKU_LENGTH = 10;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function fitSku(seed: string, preferredPrefix: string, maxLength = MAX_OFFER_SKU_LENGTH): string {
  const cleanPrefix = codePart(preferredPrefix) || 'OF';
  const prefixLength = Math.min(4, Math.max(2, maxLength - 6), cleanPrefix.length);
  const hashLength = maxLength - prefixLength;
  const hash = stableHash(seed).padStart(hashLength, '0').slice(0, hashLength);
  return `${cleanPrefix.slice(0, prefixLength)}${hash}`.slice(0, maxLength);
}

export function buildDefaultOfferSku(
  baseSku: string | null | undefined,
  offerType: ProductOfferType,
  quantity = 1,
  suffix = '',
): string {
  const cleanBase = slugPart(baseSku) || 'OFERTA';
  if (offerType === 'quantity_kit') {
    const seed = `${cleanBase}|KIT|${positiveInt(quantity, 1)}|${slugPart(suffix)}`;
    return fitSku(seed, cleanBase);
  }
  const cleanSuffix = slugPart(suffix) || 'COMBO';
  return fitSku(`${cleanBase}|COMBO|${cleanSuffix}`, cleanBase);
}

export function normalizeOfferComponents(
  items: Array<{ product: ProductOfferProductLike; quantity: number }>,
): ProductOfferComponent[] {
  return items.map(({ product, quantity }) => ({
    product_id: product.id,
    quantity: positiveInt(quantity, 1),
    sku: product.sku || null,
    name: product.name || null,
    bling_id: product.bling_id ?? null,
  }));
}

export function calculateOfferStock(
  items: Array<{ product: ProductOfferProductLike; quantity: number }>,
): number {
  if (!items.length) return 0;
  const possible = items.map(({ product, quantity }) => {
    const stock = Math.max(0, Math.trunc(Number(product.stock_quantity ?? 0) || 0));
    return Math.floor(stock / positiveInt(quantity, 1));
  });
  return Math.max(0, Math.min(...possible));
}

export function hasMissingBlingLink(items: Array<{ product: ProductOfferProductLike; quantity: number }>): boolean {
  return items.some(({ product }) => !positiveInt(product.bling_id, 0));
}

export function chooseShopeeOfferStrategy(input: {
  existingDimensionCount: number;
  requestedOfferDimensionCount: number;
}): ProductOfferShopeeStrategy {
  const total = positiveInt(input.existingDimensionCount, 0) + positiveInt(input.requestedOfferDimensionCount, 0);
  return total <= 2 ? 'variation' : 'separate_item';
}
