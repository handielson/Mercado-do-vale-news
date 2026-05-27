export function getPublicProductRouteTarget(product, routePeers = []) {
  if (!product || !product.id) return '';

  const slug = typeof product.slug === 'string' ? product.slug.trim() : '';
  if (!slug) return String(product.id);

  const hasSlugCollision = routePeers.some((peer) => (
    peer &&
    String(peer.id || '') !== String(product.id) &&
    typeof peer.slug === 'string' &&
    peer.slug.trim().toLowerCase() === slug.toLowerCase()
  ));

  return hasSlugCollision ? String(product.id) : slug;
}
