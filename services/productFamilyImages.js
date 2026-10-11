import { generateCatalogGroupKey } from './productGroupingCore.js';

// Read-only presentation: never copy a fallback into the product's stored images.
export function productImageList(images, imageUrl) {
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  return [...new Set([...(Array.isArray(images) ? images : []), imageUrl]
    .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

export function resolveProductFamilyImages(product, candidates = [], selectedVariation = false) {
  if (!product) return [];
  const key = generateCatalogGroupKey(product);
  const family = [product, ...candidates.filter(candidate => generateCatalogGroupKey(candidate) === key)]
    .filter((item, index, items) => items.findIndex(other => other.id === item.id) === index);
  const parentImages = family.map(item => productImageList(item.parent_images, item.parent_image_url)).find(images => images.length) || [];
  let specs = product.specs;
  if (typeof specs === 'string') { try { specs = JSON.parse(specs); } catch { specs = {}; } }
  const ownImages = productImageList(product.images, product.image_url);
  if (selectedVariation && specs?._inherit_parent_images !== true && ownImages.length) return ownImages;
  if (parentImages.length) return parentImages;
  // Stable legacy cover regardless of selected color, inventory order or price.
  const fallback = [...family].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(item => productImageList(item.images, item.image_url)).find(images => images.length);
  return fallback || [];
}
