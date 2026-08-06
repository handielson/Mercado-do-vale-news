export function productHasCatalogMedia(product) {
  if (!product || typeof product !== 'object') return false;

  if (Array.isArray(product.images)) {
    const validImage = product.images.find((image) => typeof image === 'string' && image.trim().length > 0);
    if (validImage) return true;
  }

  return typeof product.image_url === 'string' && product.image_url.trim().length > 0;
}

export function formatCatalogVariationLabel(label) {
  if (!label || typeof label !== 'string') return '';

  return label
    .trim()
    .toLowerCase()
    .replace(/(^|[\s/-]+)([a-zà-öø-ÿ])/g, (match, separator, character) => `${separator}${character.toUpperCase()}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCatalogMemorySuffix(name) {
  return name.replace(/,?\s*\d+\s*[GT]B\s*\/\s*\d+\s*[GT]B/gi, '').trim();
}

function stripTrailingVariation(name, variation) {
  if (!variation || typeof variation !== 'string') return name;

  const normalizedVariation = variation.trim();
  if (!normalizedVariation) return name;

  return name
    .replace(
      new RegExp(`(?:[\\s,|/-]+)?(?:cor\\s*:?\\s*)?${escapeRegex(normalizedVariation)}$`, 'i'),
      '',
    )
    .replace(/\s*cor\s*:?\s*$/i, '')
    .replace(/[\s,|/-]+$/g, '')
    .trim();
}

export function getCatalogCardDisplayName({ product, productGroup }) {
  const fallbackName = product?.model || product?.name || 'Produto';
  const baseName = productGroup?.model || product?.name || fallbackName;

  let cleanedName = stripCatalogMemorySuffix(baseName);
  cleanedName = stripTrailingVariation(cleanedName, product?.specs?.color);

  return cleanedName || stripCatalogMemorySuffix(fallbackName) || 'Produto';
}

export function selectCatalogCardProduct({ product, selectedVariant, currentColorIndex }) {
  if (!selectedVariant || !Array.isArray(selectedVariant.products) || selectedVariant.products.length === 0) {
    return product;
  }

  const selectedColor = Array.isArray(selectedVariant.colors)
    ? selectedVariant.colors[currentColorIndex]
    : null;

  if (selectedColor?.name) {
    const colorMatch = selectedVariant.products.find(
      (candidate) => candidate?.specs?.color === selectedColor.name,
    );

    if (colorMatch) return colorMatch;
  }

  const representedProduct = selectedVariant.products.find((candidate) => candidate?.id === product?.id);
  return representedProduct || selectedVariant.products[0] || product;
}

export function selectCatalogCardImageProduct({
  product,
  currentProduct,
  selectedVariant,
  currentColorIndex,
}) {
  const baseProduct = currentProduct || selectCatalogCardProduct({
    product,
    selectedVariant,
    currentColorIndex,
  });

  if (productHasCatalogMedia(baseProduct)) {
    return baseProduct;
  }

  if (productHasCatalogMedia(product)) {
    return product;
  }

  const baseColor = normalizeCatalogColor(baseProduct?.specs?.color || product?.specs?.color);
  if (baseColor && selectedVariant?.products?.length) {
    const sameColorProduct = selectedVariant.products.find((candidate) =>
      normalizeCatalogColor(candidate?.specs?.color) === baseColor && productHasCatalogMedia(candidate),
    );
    if (sameColorProduct) return sameColorProduct;
  }

  return baseProduct;
}

function normalizeCatalogColor(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
