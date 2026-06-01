export const SEO_PRODUCT_COLUMNS = 'id, name, slug, meta_title, meta_description, status, description';

export async function fetchAllSEOProducts(_legacyClient, pageSize = 1000) {
  const { vpsApiService } = await import('../../../services/vpsApiService');
  const limit = Math.max(pageSize, 5000);
  const products = await vpsApiService.getProducts({
    status: 'all',
    limit,
    noCache: true,
  });

  return (products || [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      meta_title: product.meta_title,
      meta_description: product.meta_description,
      status: product.status,
      description: product.description,
      created_at: product.created_at,
    }))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}
