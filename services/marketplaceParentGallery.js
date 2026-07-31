function parseImageList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function collectMarketplaceProductImages(product) {
  const values = [
    ...parseImageList(product?.images),
    product?.image_url,
  ];

  return Array.from(new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
}

export function buildMarketplaceParentGallery(parent, children = [], options = {}) {
  const minimumCount = Math.max(1, Number(options.minimumCount) || 1);
  const maxCount = Math.max(minimumCount, Number(options.maxCount) || 9);
  const gallery = collectMarketplaceProductImages(parent).slice(0, maxCount);
  const seen = new Set(gallery);

  for (const child of children) {
    if (gallery.length >= minimumCount) break;

    for (const imageUrl of collectMarketplaceProductImages(child)) {
      if (seen.has(imageUrl)) continue;
      seen.add(imageUrl);
      gallery.push(imageUrl);
      if (gallery.length >= minimumCount || gallery.length >= maxCount) break;
    }
  }

  return gallery.slice(0, maxCount);
}
