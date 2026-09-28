const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const uniqueById = (products) => {
  const seen = new Set();
  return products.filter((product) => {
    const id = String(product?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export function buildProductFamilyGroups(filteredProducts = [], allProducts = filteredProducts) {
  const allById = new Map(allProducts.map((product) => [String(product.id), product]));
  const allChildrenByParent = new Map();
  for (const product of allProducts) {
    if (!product.parent_id) continue;
    const parentId = String(product.parent_id);
    const children = allChildrenByParent.get(parentId) || [];
    children.push(product);
    allChildrenByParent.set(parentId, children);
  }

  const groups = new Map();
  for (const product of filteredProducts) {
    const parentId = product.parent_id ? String(product.parent_id) : null;
    const familyId = parentId || (Number(product.is_parent) === 1 ? String(product.id) : null);
    const key = familyId ? `family:${familyId}` : `product:${product.id}`;
    const current = groups.get(key) || {
      key,
      familyId,
      parent: familyId ? allById.get(familyId) || null : null,
      products: [],
      matchedProducts: [],
      isFamily: Boolean(familyId),
      orphaned: Boolean(parentId && !allById.has(parentId)),
      totalVariationCount: familyId ? (allChildrenByParent.get(familyId) || []).length : 0,
    };
    current.matchedProducts.push(product);
    if (Number(product.is_parent) === 1) current.parent = product;
    else current.products.push(product);
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    const products = uniqueById(group.products);
    const representative = group.parent || products[0] || group.matchedProducts[0];
    const familyProducts = uniqueById(group.familyId
      ? (allChildrenByParent.get(group.familyId) || products)
      : products);
    const parentMatched = Boolean(group.parent && group.matchedProducts.some((product) => String(product.id) === String(group.parent.id)));
    const displayedProducts = parentMatched && familyProducts.length > 0 ? familyProducts : products;
    const sellableProducts = familyProducts.length > 0 ? familyProducts : [representative].filter(Boolean);
    const prices = sellableProducts.map((product) => numberValue(product.price_retail)).filter((price) => price > 0);
    const selectionProducts = uniqueById([
      ...(group.parent ? [group.parent] : []),
      ...familyProducts,
    ]);
    return {
      ...group,
      products: displayedProducts,
      familyProducts,
      representative,
      selectionProducts,
      totalStock: sellableProducts.reduce((total, product) => total + numberValue(product.stock_quantity), 0),
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      totalVariationCount: Math.max(group.totalVariationCount, products.length),
    };
  });
}

export function paginateProductFamilyGroups(groups, currentPage, itemsPerPage) {
  const safeItemsPerPage = Math.max(1, Number(itemsPerPage) || 1);
  const totalPages = Math.max(1, Math.ceil(groups.length / safeItemsPerPage));
  const safePage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  const start = (safePage - 1) * safeItemsPerPage;
  return {
    currentPage: safePage,
    totalPages,
    groups: groups.slice(start, start + safeItemsPerPage),
  };
}
