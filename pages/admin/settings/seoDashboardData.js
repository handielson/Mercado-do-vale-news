export const SEO_PRODUCT_COLUMNS = 'id, name, slug, meta_title, meta_description, status, description';

export async function fetchAllSEOProducts(supabase, pageSize = 1000) {
  const products = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('products')
      .select(SEO_PRODUCT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = data || [];
    products.push(...page);

    if (page.length < pageSize) {
      return products;
    }

    from += pageSize;
  }
}
