import type {
  ShopeeVariationBuildContext,
  ShopeeVariationDimension,
  ShopeeVariationDimensionKey,
  ShopeeVariationGroup,
  ShopeeVariationPayloadParts,
  ShopeeVariationProduct,
  ShopeeVariationValidationIssue,
  ShopeeVariationValidationResult,
} from '../types/shopee-variation';

const DIMENSION_LABELS: Record<ShopeeVariationDimensionKey, string> = {
  color: 'Cor',
  model: 'Modelo',
  size: 'Tamanho',
  ram: 'RAM',
  storage: 'Armazenamento',
};

const DIMENSION_KEYS: ShopeeVariationDimensionKey[] = ['color', 'model', 'size', 'ram', 'storage'];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function centsToReais(value: unknown): number {
  const cents = Number(value ?? 0);
  return Number.isFinite(cents) && cents > 0 ? Number((cents / 100).toFixed(2)) : 0;
}

function readSpec(product: ShopeeVariationProduct, key: ShopeeVariationDimensionKey): string {
  const specs = product.specs || {};
  if (key === 'color') return text(specs.color || specs.cor);
  if (key === 'storage') return text(specs.storage || specs.armazenamento);
  return text(specs[key]);
}

function firstEan(product: ShopeeVariationProduct): string {
  const eans = Array.isArray(product.eans) ? product.eans : [];
  return text(eans.find((ean) => text(ean)));
}

export function groupShopeeVariationCandidates(products: ShopeeVariationProduct[]): ShopeeVariationGroup[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const idByBlingId = new Map(
    products
      .map((product) => [text(product.bling_id), product.id] as const)
      .filter(([blingId]) => Boolean(blingId))
  );
  const childrenByParent = new Map<string, ShopeeVariationProduct[]>();

  for (const product of products) {
    const parentId = text(product.parent_id) || idByBlingId.get(text(product.bling_parent_id)) || '';
    if (!parentId) continue;
    const current = childrenByParent.get(parentId) || [];
    current.push(product);
    childrenByParent.set(parentId, current);
  }

  return Array.from(childrenByParent.entries())
    .map(([parentId, children]) => {
      const parent = byId.get(parentId);
      if (!parent || children.length < 2) return null;
      return {
        id: parentId,
        parent,
        children: children.slice(),
      };
    })
    .filter((group): group is ShopeeVariationGroup => Boolean(group));
}

export function detectShopeeVariationDimensions(group: ShopeeVariationGroup): ShopeeVariationDimension[] {
  return DIMENSION_KEYS
    .map((key) => {
      const values = Array.from(new Set(group.children.map((child) => readSpec(child, key)).filter(Boolean)));
      return { name: DIMENSION_LABELS[key], key, options: values };
    })
    .filter((dimension) => dimension.options.length > 1)
    .slice(0, 2);
}

export function validateShopeeVariationGroup(
  group: ShopeeVariationGroup,
  dimensions: ShopeeVariationDimension[],
): ShopeeVariationValidationResult {
  const blockers: ShopeeVariationValidationIssue[] = [];
  const warnings: ShopeeVariationValidationIssue[] = [];

  if (dimensions.length === 0) {
    blockers.push({ field: 'variation_dimensions', message: 'Nenhuma dimensao de variacao foi detectada.' });
  }

  for (const child of group.children) {
    if (!text(child.sku)) blockers.push({ productId: child.id, field: 'sku', message: 'Variacao sem SKU.' });
    if (centsToReais(child.price_retail) <= 0) blockers.push({ productId: child.id, field: 'price_retail', message: 'Variacao sem preco valido.' });
    if (!Array.isArray(child.images) || child.images.length === 0) warnings.push({ productId: child.id, field: 'images', message: 'Variacao sem imagem propria; sera usada imagem do anuncio.' });

    for (const dimension of dimensions) {
      if (!readSpec(child, dimension.key)) {
        blockers.push({ productId: child.id, field: dimension.key, message: `Variacao sem valor para ${dimension.name}.` });
      }
    }
  }

  return { ok: blockers.length === 0, blockers, warnings };
}

export function buildShopeeVariationModels(
  group: ShopeeVariationGroup,
  dimensions: ShopeeVariationDimension[],
  context: ShopeeVariationBuildContext,
): ShopeeVariationPayloadParts {
  const tier_variation = dimensions.map((dimension) => ({
    name: dimension.name,
    option_list: dimension.options.map((option) => {
      const child = group.children.find((product) => readSpec(product, dimension.key) === option);
      const imageId = child ? context.imageIdsByProductId[child.id] : '';
      return {
        option,
        ...(dimension.key === 'color' && imageId ? { image: { image_id: imageId } } : {}),
      };
    }),
  }));

  const model_list = group.children.map((child) => {
    const tierIndex = dimensions.map((dimension) => Math.max(0, dimension.options.indexOf(readSpec(child, dimension.key))));
    const gtin = firstEan(child);
    return {
      tier_index: tierIndex,
      model_sku: text(child.sku),
      original_price: centsToReais(child.price_retail),
      seller_stock: [{ stock: Math.max(0, Math.trunc(Number(context.stockByProductId?.[child.id] ?? child.stock_quantity ?? 0) || 0)) }],
      ...(gtin ? { gtin_code: gtin, tax_info: { gtin } } : {}),
    };
  });

  return { tier_variation, model_list };
}
