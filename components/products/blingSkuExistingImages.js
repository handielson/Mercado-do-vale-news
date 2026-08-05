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
