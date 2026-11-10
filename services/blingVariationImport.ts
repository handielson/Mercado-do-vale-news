export interface BlingVariationListItem {
  id: number;
  formato?: string;
  variacao?: { produtoPai?: { id?: number } };
}

export function getBlingParentId(product: BlingVariationListItem): number | null {
  const value = Number(product?.variacao?.produtoPai?.id);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function expandBlingSearchFamilies<T extends BlingVariationListItem>(
  products: T[],
  loadFamily: (parentId: number) => Promise<any>,
): Promise<T[]> {
  const byId = new Map(products.map(product => [Number(product.id), product]));
  for (const parent of products.filter(product => String(product.formato).toUpperCase() === 'V' && !getBlingParentId(product))) {
    const payload = await loadFamily(Number(parent.id));
    const data = payload?.data || payload;
    const rows = Array.isArray(data) ? data : data?.variacoes;
    if (!Array.isArray(rows)) throw new Error('Não foi possível carregar todas as variações do Bling. Atualize a pesquisa.');
    for (const entry of rows) {
      const child = entry.produto || entry;
      if (!Number.isSafeInteger(Number(child.id)) || Number(child.id) <= 0 || Number(child.id) === Number(parent.id)) {
        throw new Error('O Bling retornou uma variação inválida. Atualize a pesquisa.');
      }
      byId.set(Number(child.id), {
        ...child,
        variacao: { ...child.variacao, produtoPai: { ...child.variacao?.produtoPai, id: Number(parent.id) } },
      });
    }
  }
  return Array.from(byId.values());
}

// Bling API v3: formato 'S' = simples, 'V' = com variações (pai), 'E' = com composição (kit).
// Kit ('E') é produto vendável com preço próprio — não é pai de variações.
export function isBlingStructureProduct(product: BlingVariationListItem): boolean {
  const format = String(product?.formato || '').trim().toUpperCase();
  return format === 'V';
}

export function isBlingKitProduct(product: BlingVariationListItem): boolean {
  return String(product?.formato || '').trim().toUpperCase() === 'E';
}

export function buildBlingImportSelection<T extends BlingVariationListItem>(
  selectedProducts: T[],
  availableProducts: T[] = selectedProducts,
): { products: T[]; missingParentIds: number[] } {
  const byId = new Map<number, T>();
  for (const product of [...availableProducts, ...selectedProducts]) byId.set(Number(product.id), product);

  const includedIds = new Set(selectedProducts.map((product) => Number(product.id)));
  const selectedGroupParentIds = new Set<number>(
    selectedProducts.map(getBlingParentId).filter((id): id is number => id !== null)
  );
  for (const product of selectedProducts) {
    if (isBlingStructureProduct(product) && !getBlingParentId(product)) {
      selectedGroupParentIds.add(Number(product.id));
    }
  }

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

  const wholeGroupSelected = next.has(parentId) && childIds.every((id) => next.has(id));
  if (wholeGroupSelected) {
    next.delete(parentId);
    childIds.forEach((id) => next.delete(id));
  } else {
    next.add(parentId);
    childIds.forEach((id) => next.add(id));
  }
  return next;
}

export interface BlingKitComponent {
  blingId: number;
  quantity: number;
}

export interface BlingKitOfferLink {
  offer_type: 'quantity_kit' | 'product_combo';
  offer_parent_product_id: string | null;
  combo_children: Array<{ id: string; quantity: number }>;
}

// Bling API v3: produto com composição (formato 'E') traz estrutura.componentes
// [{ produto: { id }, quantidade }]. Componentes repetidos são somados.
export function parseBlingKitComponents(detail: any): BlingKitComponent[] {
  const rows = Array.isArray(detail?.estrutura?.componentes) ? detail.estrutura.componentes : [];
  const byId = new Map<number, number>();
  for (const row of rows) {
    const blingId = Number(row?.produto?.id ?? row?.id);
    const quantity = Number(row?.quantidade ?? row?.quantity ?? 1);
    if (!Number.isSafeInteger(blingId) || blingId <= 0) continue;
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    byId.set(blingId, (byId.get(blingId) || 0) + safeQuantity);
  }
  return Array.from(byId, ([blingId, quantity]) => ({ blingId, quantity }));
}

// Converte os componentes do kit do Bling no modelo local de oferta/combo:
// um único componente vira 'quantity_kit' (ex.: kit com 5 unidades do mesmo produto);
// mais de um vira 'product_combo'. O estoque do kit passa a ser derivado dos componentes.
export function buildBlingKitOfferLink(
  components: BlingKitComponent[],
  localIdByBlingId: (blingId: number) => string | null | undefined,
): BlingKitOfferLink {
  if (!components.length) {
    throw new Error('kit_sem_componentes: o Bling não retornou a composição deste kit.');
  }
  const missing = components.filter((component) => !localIdByBlingId(component.blingId));
  if (missing.length) {
    throw new Error(
      `kit_componente_nao_importado: importe primeiro o(s) produto(s) do Bling ${missing.map((c) => c.blingId).join(', ')} e depois reimporte o kit.`
    );
  }
  const combo_children = components.map((component) => ({
    id: String(localIdByBlingId(component.blingId)),
    quantity: component.quantity,
  }));
  const single = combo_children.length === 1;
  return {
    offer_type: single ? 'quantity_kit' : 'product_combo',
    offer_parent_product_id: single ? combo_children[0].id : null,
    combo_children,
  };
}
