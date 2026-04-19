function normalizeShopeeDescription(value) {
  if (!value) return '';

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function parseStockValue(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function getBlingDescription(detail) {
  return normalizeShopeeDescription(
    detail?.descricaoComplementar ||
      detail?.descricaoCurta ||
      detail?.descricao ||
      ''
  );
}

function resolveShopeeSyncDefaults(product, blingDetail) {
  const blingDescription = getBlingDescription(blingDetail);
  const localDescription = normalizeShopeeDescription(product?.description || product?.name || '');

  return {
    description: blingDescription || localDescription,
    stock: parseStockValue(blingDetail?.stock_quantity ?? product?.stock_quantity ?? 0),
  };
}

export {
  getBlingDescription,
  normalizeShopeeDescription,
  parseStockValue,
  resolveShopeeSyncDefaults,
};
