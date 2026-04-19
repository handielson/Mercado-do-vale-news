function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function getCategoryChildren(cat) {
  return Array.isArray(cat?.children) ? cat.children : [];
}

export function isLeafCategory(cat) {
  if (cat?.leaf_category === true || cat?.is_leaf === true) return true;
  if (cat?.has_children === false) return true;
  return getCategoryChildren(cat).length === 0;
}

export function getCategoryPathLabel(cat, trail = []) {
  const currentName = String(cat?.display_category_name || cat?.original_category_name || '').trim();
  const parts = [...trail, currentName].filter(Boolean);
  return parts.join(' > ');
}

export function buildCategoryTree(flatCategories) {
  if (!Array.isArray(flatCategories) || flatCategories.length === 0) {
    return [];
  }

  const nodeMap = new Map();

  flatCategories.forEach((rawCategory) => {
    const categoryId = String(rawCategory?.category_id ?? '').trim();
    if (!categoryId) return;

    nodeMap.set(categoryId, {
      ...rawCategory,
      children: [],
    });
  });

  const roots = [];

  nodeMap.forEach((node) => {
    const parentId = String(node?.parent_category_id ?? '').trim();
    const parent = parentId && parentId !== '0' ? nodeMap.get(parentId) : null;

    if (parent) {
      parent.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

function flattenCategoryTree(cats, trail = [], rootLabel = '') {
  return cats.flatMap((cat) => {
    const currentName = String(cat?.display_category_name || cat?.original_category_name || '').trim();
    const nextTrail = [...trail, currentName].filter(Boolean);
    const nextRootLabel = rootLabel || currentName;
    const currentEntry = {
      ...cat,
      __pathLabel: getCategoryPathLabel(cat, trail),
      __rootLabel: nextRootLabel,
    };
    return [currentEntry, ...flattenCategoryTree(getCategoryChildren(cat), nextTrail, nextRootLabel)];
  });
}

function scoreCategoryMatch(category, query) {
  const normalizedQuery = normalizeText(query);
  const name = normalizeText(category?.display_category_name || category?.original_category_name || '');
  const path = normalizeText(category?.__pathLabel || '');

  if (!normalizedQuery) return 0;
  if (path === normalizedQuery) return 100;
  if (name === normalizedQuery) return 90;
  if (path.startsWith(normalizedQuery)) return 80;
  if (name.startsWith(normalizedQuery)) return 70;
  if (path.includes(normalizedQuery)) return 60;

  const queryTokens = tokenize(normalizedQuery);
  const pathTokens = new Set(tokenize(path));
  const commonTokens = queryTokens.filter((token) => pathTokens.has(token)).length;
  return commonTokens * 10;
}

export function searchShopeeCategories(categoryTree, query, limit = 40) {
  const flatCategories = flattenCategoryTree(categoryTree).filter((entry) => isLeafCategory(entry));
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return flatCategories.slice(0, limit);
  }

  const matches = flatCategories
    .map((entry) => ({
      ...entry,
      __score: scoreCategoryMatch(entry, normalizedQuery),
    }))
    .filter((entry) => entry.__score > 0);

  const groups = new Map();
  for (const match of matches) {
    const key = match.__rootLabel || 'Sem raiz';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => b.__score - a.__score || a.__pathLabel.localeCompare(b.__pathLabel, 'pt-BR'));
  }

  const orderedRoots = [...groups.entries()]
    .sort((a, b) => {
      const scoreDiff = (b[1][0]?.__score || 0) - (a[1][0]?.__score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a[0].localeCompare(b[0], 'pt-BR');
    })
    .map(([rootLabel]) => rootLabel);

  const diversified = [];
  let depth = 0;

  while (diversified.length < limit) {
    let addedOnRound = false;

    for (const rootLabel of orderedRoots) {
      const group = groups.get(rootLabel) || [];
      if (group[depth]) {
        diversified.push(group[depth]);
        addedOnRound = true;
        if (diversified.length >= limit) break;
      }
    }

    if (!addedOnRound) break;
    depth += 1;
  }

  return diversified;
}

function buildCategoryIndex(categoryTree) {
  const byId = new Map();
  flattenCategoryTree(categoryTree).forEach((entry) => {
    byId.set(Number(entry.category_id), entry);
  });
  return byId;
}

function scoreHistoricalMatch(productName, historicalProduct) {
  const queryTokens = new Set(tokenize(productName));
  const nameTokens = new Set(tokenize(historicalProduct?.name || ''));
  const skuQuery = normalizeText(historicalProduct?.sku || '');
  const normalizedProductName = normalizeText(productName);

  let score = 0;

  for (const token of queryTokens) {
    if (nameTokens.has(token)) score += 3;
  }

  if (skuQuery && normalizedProductName.includes(skuQuery)) {
    score += 10;
  }

  if (normalizeText(historicalProduct?.name || '') === normalizedProductName) {
    score += 15;
  }

  return score;
}

export function suggestShopeeCategories({ productName, categoryTree, historicalProducts = [], limit = 5 }) {
  const categoryIndex = buildCategoryIndex(categoryTree);
  const ranked = [];

  for (const historicalProduct of historicalProducts) {
    const categoryId = Number(historicalProduct?.shopee_category_id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) continue;

    const category = categoryIndex.get(categoryId);
    if (!category || !isLeafCategory(category)) continue;

    const score = scoreHistoricalMatch(productName, historicalProduct);
    if (score <= 0) continue;

    ranked.push({
      ...category,
      __score: score,
      reason: `Historico parecido: ${historicalProduct?.name || 'produto sincronizado'}`,
    });
  }

  const uniqueByCategory = new Map();
  for (const entry of ranked.sort((a, b) => b.__score - a.__score)) {
    if (!uniqueByCategory.has(entry.category_id)) {
      uniqueByCategory.set(entry.category_id, entry);
    }
  }

  return [...uniqueByCategory.values()].slice(0, limit);
}
