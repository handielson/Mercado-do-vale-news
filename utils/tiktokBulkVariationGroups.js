function normalizeGroupText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasColorSuffix(value) {
  return /\s*(?:[-|,]\s*)?cor\s*:\s*.+$/i.test(String(value || '').trim());
}

function variationBaseName(value) {
  return normalizeGroupText(String(value || '').replace(/\s*(?:[-|,]\s*)?cor\s*:\s*.+$/i, ''));
}

/**
 * Consolida tanto os grupos persistidos quanto familias legadas que possuem
 * um item-base e variacoes terminadas em "Cor:...".
 */
export function buildTikTokBulkVariationGroups(products) {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const parentIdByChild = new Map();
  const childrenByParent = new Map();

  const linkChild = (parentId, child) => {
    const normalizedParentId = String(parentId || '');
    const childId = String(child?.id || '');
    if (!normalizedParentId || !childId || normalizedParentId === childId || parentIdByChild.has(childId)) return;
    parentIdByChild.set(childId, normalizedParentId);
    const current = childrenByParent.get(normalizedParentId) || [];
    current.push(child);
    childrenByParent.set(normalizedParentId, current);
  };

  for (const product of products) {
    const parentId = String(product.parent_id || '');
    if (parentId && byId.has(parentId)) linkChild(parentId, product);
  }

  const productsByBaseName = new Map();
  for (const product of products) {
    const baseName = variationBaseName(product.name);
    if (!baseName) continue;
    const current = productsByBaseName.get(baseName) || [];
    current.push(product);
    productsByBaseName.set(baseName, current);
  }

  for (const family of productsByBaseName.values()) {
    const parent = family.find((product) =>
      !product.parent_id &&
      !hasColorSuffix(product.name)
    );
    if (!parent) continue;

    const variations = family.filter((product) =>
      String(product.id) !== String(parent.id) &&
      hasColorSuffix(product.name)
    );
    if (variations.length === 0) continue;

    for (const variation of variations) linkChild(parent.id, variation);
  }

  return {
    parentIds: new Set(childrenByParent.keys()),
    parentIdByChild,
    childrenByParent,
  };
}
