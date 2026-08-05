function parseImageValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [trimmed];
}

export function resolveExistingProductImages(product = {}, limit = 5) {
  const candidates = [
    ...parseImageValue(product.images),
    ...parseImageValue(product.product_images),
    ...parseImageValue(product.custom_images),
    ...parseImageValue(product.image_url),
    ...parseImageValue(product.image),
  ];
  const seen = new Set();

  return candidates
    .map((image) => typeof image === 'string' ? image.trim() : '')
    .filter((image) => {
      if (!image || seen.has(image)) return false;
      seen.add(image);
      return true;
    })
    .slice(0, limit);
}

function normalizeComparableText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function resolveSiblingProductImages(products, product, limit = 5) {
  if (!Array.isArray(products)) return [];

  const productColor = normalizeComparableText(product?.specs?.color);
  const productSlug = normalizeComparableText(product?.slug || product?.specs?.slug);
  const productName = normalizeComparableText(product?.name);

  return products
    .filter((candidate) => String(candidate?.id || '') !== String(product?.id || ''))
    .map((candidate) => {
      const images = resolveExistingProductImages(candidate, limit);
      if (images.length === 0) return null;

      const candidateColor = normalizeComparableText(candidate?.specs?.color);
      const candidateSlug = normalizeComparableText(candidate?.slug || candidate?.specs?.slug);
      const candidateName = normalizeComparableText(candidate?.name);
      let score = 0;

      if (productColor && candidateColor === productColor) score += 4;
      if (productSlug && candidateSlug === productSlug) score += 2;
      if (productName && candidateName === productName) score += 1;

      return { images, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0]?.images || [];
}
