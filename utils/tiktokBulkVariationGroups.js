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
 * Consolida grupos persistidos, familias legadas com item-base e variacoes
 * que compartilham apenas o pai do Bling.
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

  const productsByBlingParent = new Map();
  for (const product of products) {
    const blingParentId = String(product.bling_parent_id || '').trim();
    if (!blingParentId || blingParentId === '0') continue;
    const current = productsByBlingParent.get(blingParentId) || [];
    current.push(product);
    productsByBlingParent.set(blingParentId, current);
  }

  for (const family of productsByBlingParent.values()) {
    if (family.length < 2) continue;

    const alreadyGrouped = family.some((product) => {
      const productId = String(product.id || '');
      return parentIdByChild.has(productId) || childrenByParent.has(productId);
    });
    if (alreadyGrouped) continue;

    const parent = family.find((product) => Number(product.stock_quantity || 0) > 0);
    if (!parent) continue;

    for (const variation of family) {
      if (String(variation.id) !== String(parent.id)) linkChild(parent.id, variation);
    }
  }

  return {
    parentIds: new Set(childrenByParent.keys()),
    parentIdByChild,
    childrenByParent,
  };
}
