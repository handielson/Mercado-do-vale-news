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

const htmlEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export const htmlToPlainText = (value, maxLength = null) => {
  const plain = String(value ?? '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
      if (code[0] === '#') {
        const number = code[1].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : ' ';
      }
      return htmlEntities[code.toLowerCase()] ?? ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (!Number.isInteger(maxLength) || maxLength <= 0 || plain.length <= maxLength) return plain;
  const shortened = plain.slice(0, maxLength + 1).replace(/\s+\S*$/, '').trim();
  return (shortened || plain.slice(0, maxLength)).slice(0, maxLength);
};

export function fillStorefrontOfferFromProduct(storefront, saved, product, categoryName = null) {
  return {
    storefront,
    publication_status: saved?.publication_status || 'draft',
    title: savedOr(saved, 'title', text(product?.name)),
    description: null,
    category_label: savedOr(saved, 'category_label', text(categoryName || product?.category_name)),
    slug: savedOr(saved, 'slug', text(product?.slug)),
    price_retail: savedOr(saved, 'price_retail', cents(product?.price_retail)),
    price_reseller: savedOr(saved, 'price_reseller', cents(product?.price_reseller)),
    price_wholesale: savedOr(saved, 'price_wholesale', cents(product?.price_wholesale)),
    price_promo: savedOr(saved, 'price_promo', cents(product?.price_promo)),
    meta_title: savedOr(saved, 'meta_title', text(product?.meta_title) || text(product?.name)),
    meta_description: htmlToPlainText(
      savedOr(saved, 'meta_description', text(product?.meta_description) || text(product?.description)),
      160,
    ),
  };
}
