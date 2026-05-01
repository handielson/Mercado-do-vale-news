export function getCategoryDisplayCountMap(categories, productGroups) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeGroups = Array.isArray(productGroups) ? productGroups : [];
  const counts = new Map();

  for (const category of safeCategories) {
    if (category?.id) counts.set(category.id, 0);
  }

  for (const group of safeGroups) {
    const categoryId = group?.representativeProduct?.category_id;
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }

  for (const category of safeCategories) {
    if (category?.parent_id) {
      counts.set(
        category.parent_id,
        (counts.get(category.parent_id) || 0) + (counts.get(category.id) || 0),
      );
    }
  }

  return counts;
}

export function mergeCategoryDisplayCounts(categories, productGroups, options = {}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const onlyCategoryIds = Array.isArray(options.onlyCategoryIds)
    ? new Set(options.onlyCategoryIds.filter(Boolean))
    : null;
  const displayCounts = getCategoryDisplayCountMap(safeCategories, productGroups);

  return safeCategories.map(category => {
    if (!category?.id) return category;
    if (onlyCategoryIds && !onlyCategoryIds.has(category.id)) return category;
    return {
      ...category,
      count: displayCounts.get(category.id) ?? 0,
    };
  });
}
