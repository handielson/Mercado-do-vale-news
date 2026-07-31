export interface BlingVariationListItem {
  id: number;
  formato?: string;
  variacao?: { produtoPai?: { id?: number } };
}

export function getBlingParentId(product: BlingVariationListItem): number | null {
  const value = Number(product?.variacao?.produtoPai?.id);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isBlingStructureProduct(product: BlingVariationListItem): boolean {
  const format = String(product?.formato || '').trim().toUpperCase();
  return format === 'E' || format === 'V';
}

export function buildBlingImportSelection<T extends BlingVariationListItem>(
  selectedProducts: T[],
  availableProducts: T[] = selectedProducts,
): { products: T[]; missingParentIds: number[] } {
  const byId = new Map<number, T>();
  for (const product of [...availableProducts, ...selectedProducts]) byId.set(Number(product.id), product);

  const includedIds = new Set(selectedProducts.map((product) => Number(product.id)));
  const selectedGroupParentIds = new Set(
    selectedProducts.map(getBlingParentId).filter((id): id is number => id !== null)
  );

  // Uma variacao selecionada representa o grupo inteiro: pai + todos os filhos.
  for (const parentId of selectedGroupParentIds) {
    includedIds.add(parentId);
    for (const product of availableProducts) {
      if (getBlingParentId(product) === parentId) includedIds.add(Number(product.id));
    }
  }

  const missingParentIds = Array.from(selectedGroupParentIds).filter((id) => !byId.has(id));
  const products = Array.from(includedIds)
    .map((id) => byId.get(id))
    .filter((product): product is T => Boolean(product))
    .sort((left, right) => {
      const leftParent = isBlingStructureProduct(left) || selectedGroupParentIds.has(Number(left.id));
      const rightParent = isBlingStructureProduct(right) || selectedGroupParentIds.has(Number(right.id));
      return Number(rightParent) - Number(leftParent);
    });

  return { products, missingParentIds };
}

export function expandBlingSelectionIds<T extends BlingVariationListItem>(
  selectedIds: Iterable<number>,
  availableProducts: T[],
): Set<number> {
  const selectedSet = new Set(Array.from(selectedIds, Number));
  const selectedProducts = availableProducts.filter((product) => selectedSet.has(Number(product.id)));
  const plan = buildBlingImportSelection(selectedProducts, availableProducts);
  return new Set(plan.products.map((product) => Number(product.id)));
}

export function toggleBlingSelectionGroup<T extends BlingVariationListItem>(
  selectedIds: Iterable<number>,
  productId: number,
  availableProducts: T[],
): Set<number> {
  const next = new Set(Array.from(selectedIds, Number));
  const product = availableProducts.find((item) => Number(item.id) === Number(productId));
  if (!product) return next;

  const directParentId = getBlingParentId(product);
  const parentId = directParentId || (isBlingStructureProduct(product) ? Number(product.id) : null);
  if (!parentId) {
    next.has(productId) ? next.delete(productId) : next.add(productId);
    return next;
  }

  const childIds = availableProducts
    .filter((item) => getBlingParentId(item) === parentId)
    .map((item) => Number(item.id));

  if (!directParentId) {
    if (next.has(parentId)) {
      next.delete(parentId);
      childIds.forEach((id) => next.delete(id));
    } else {
      next.add(parentId); // pai sozinho
    }
    return next;
  }

  const wholeGroupSelected = next.has(parentId) && childIds.every((id) => next.has(id));
  if (wholeGroupSelected) {
    childIds.forEach((id) => next.delete(id));
    next.add(parentId); // segundo clique reduz de "todos" para "somente pai"
  } else {
    next.add(parentId);
    childIds.forEach((id) => next.add(id));
  }
  return next;
}
