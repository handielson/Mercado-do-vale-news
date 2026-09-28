const text = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const cents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : null;
};

const savedOr = (saved, key, fallback) => saved && saved[key] !== null && saved[key] !== undefined
  ? saved[key]
  : fallback;

export function fillStorefrontOfferFromProduct(storefront, saved, product, categoryName = null) {
  return {
    storefront,
    publication_status: saved?.publication_status || 'draft',
    title: savedOr(saved, 'title', text(product?.name)),
    description: savedOr(saved, 'description', text(product?.description)),
    category_label: savedOr(saved, 'category_label', text(categoryName || product?.category_name)),
    slug: savedOr(saved, 'slug', text(product?.slug)),
    price_retail: savedOr(saved, 'price_retail', cents(product?.price_retail)),
    price_reseller: savedOr(saved, 'price_reseller', cents(product?.price_reseller)),
    price_wholesale: savedOr(saved, 'price_wholesale', cents(product?.price_wholesale)),
    price_promo: savedOr(saved, 'price_promo', cents(product?.price_promo)),
    meta_title: savedOr(saved, 'meta_title', text(product?.meta_title) || text(product?.name)),
    meta_description: savedOr(saved, 'meta_description', text(product?.meta_description) || text(product?.description)),
  };
}
