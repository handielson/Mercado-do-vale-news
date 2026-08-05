function slugifyProductName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getPublicProductRouteTarget(product) {
  if (!product || !product.id) return '';

  const slug = typeof product.slug === 'string' ? product.slug.trim() : '';
  if (slug) return slug;

  return slugifyProductName(product.name) || String(product.id);
}

export function getPublicProductDisambiguatedRouteTarget(product) {
  const routeTarget = getPublicProductRouteTarget(product);
  if (!product || !product.id) return routeTarget;

  const specs = product.specs && typeof product.specs === 'object' ? product.specs : {};
  const suffixParts = [specs.color || specs.cor, specs.ram, specs.storage]
    .map(slugifyProductName)
    .filter((part, index, parts) => part && parts.indexOf(part) === index);
  const suffix = suffixParts.join('-') || slugifyProductName(product.sku);

  return suffix ? `${routeTarget}-${suffix}` : routeTarget;
}

export function getPublicProductVariantRouteTarget(product, routePeers = []) {
  const routeTarget = getPublicProductRouteTarget(product);
  if (!product || !product.id) return routeTarget;

  const hasSlugCollision = routePeers.some((peer) => (
    peer &&
    String(peer.id || '') !== String(product.id) &&
    getPublicProductRouteTarget(peer).toLowerCase() === routeTarget.toLowerCase()
  ));

  return hasSlugCollision ? getPublicProductDisambiguatedRouteTarget(product) : routeTarget;
}
