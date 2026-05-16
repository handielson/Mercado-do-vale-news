import type { ShopeeVariationGroup, ShopeeVariationProduct } from '../types/shopee-variation';

type ShopeeOfferProduct = ShopeeVariationProduct & {
  offer_type?: 'quantity_kit' | 'product_combo' | null;
  offer_parent_product_id?: string | null;
  shopee_strategy?: 'variation' | 'separate_item' | null;
  combo_children?: Array<{ id: string; quantity?: number }>;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function quantityFromOffer(product: ShopeeOfferProduct): number {
  const childQuantity = Number(product.combo_children?.[0]?.quantity);
  if (Number.isFinite(childQuantity) && childQuantity > 0) return Math.trunc(childQuantity);

  const match = text(product.name).match(/^(\d+)\s*x?/i);
  const fromName = Number(match?.[1]);
  return Number.isFinite(fromName) && fromName > 0 ? Math.trunc(fromName) : 2;
}

export function isShopeeOfferProduct(product: unknown): product is ShopeeOfferProduct {
  return Boolean((product as ShopeeOfferProduct | null)?.offer_type);
}

export function getShopeeOfferVariationLabel(product: ShopeeOfferProduct): string {
  if (product.offer_type === 'quantity_kit') return `Kit ${quantityFromOffer(product)} un`;
  return 'Kit combo';
}

function withModelOption(product: ShopeeVariationProduct, option: string): ShopeeVariationProduct {
  return {
    ...product,
    specs: {
      ...(product.specs || {}),
      model: option,
    },
  };
}

export function buildShopeeOfferVariationGroup(
  offer: ShopeeOfferProduct,
  products: ShopeeVariationProduct[],
): ShopeeVariationGroup | null {
  if (!isShopeeOfferProduct(offer)) return null;
  if (offer.shopee_strategy !== 'variation') return null;

  const parentId = text(offer.offer_parent_product_id) || text(offer.combo_children?.[0]?.id);
  if (!parentId) return null;

  const base = products.find((product) => text(product.id) === parentId);
  if (!base) return null;

  return {
    id: `${base.id}:offer:${offer.id}`,
    parent: withModelOption(base, 'Unidade'),
    children: [
      withModelOption(base, 'Unidade'),
      withModelOption(offer, getShopeeOfferVariationLabel(offer)),
    ],
  };
}

export function buildShopeeOfferVariationGroups(products: ShopeeVariationProduct[]): ShopeeVariationGroup[] {
  return products
    .filter(isShopeeOfferProduct)
    .map((offer) => buildShopeeOfferVariationGroup(offer, products))
    .filter((group): group is ShopeeVariationGroup => Boolean(group));
}
