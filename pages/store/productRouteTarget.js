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

export function getPublicProductVariantRouteTarget(product, routePeers = []) {
  const routeTarget = getPublicProductRouteTarget(product);
  if (!product || !product.id) return routeTarget;

  const hasSlugCollision = routePeers.some((peer) => (
    peer &&
    String(peer.id || '') !== String(product.id) &&
    getPublicProductRouteTarget(peer).toLowerCase() === routeTarget.toLowerCase()
  ));

  return hasSlugCollision ? String(product.id) : routeTarget;
}
