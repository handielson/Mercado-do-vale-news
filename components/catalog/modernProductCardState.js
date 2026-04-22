export function productHasCatalogMedia(product) {
  if (!product || typeof product !== 'object') return false;

  if (Array.isArray(product.images)) {
    const validImage = product.images.find((image) => typeof image === 'string' && image.trim().length > 0);
    if (validImage) return true;
  }

  return typeof product.image_url === 'string' && product.image_url.trim().length > 0;
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

  if (selectedVariant?.products?.length) {
    return selectedVariant.products.find(productHasCatalogMedia) || baseProduct;
  }

  return baseProduct;
}
