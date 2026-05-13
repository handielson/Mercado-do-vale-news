function normalizeShopeeDescription(value) {
  if (!value) return '';

  return String(value)
    .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|\u00a0|<br\s*\/?\s*>)*<\/p>/gi, '')
    .replace(/&nbsp;|&#160;|\u00a0/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|li|h[1-6])>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
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

function positiveNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getBlingDescription(detail) {
  return normalizeShopeeDescription(
    detail?.descricaoComplementar ||
      detail?.descricaoCurta ||
      detail?.descricao ||
      ''
  );
}

function getBlingPhysicalDefaults(detail) {
  const dimensions = detail?.dimensoes || detail?.aspec || detail?.aspecto || detail?.aspectos || {};
  const weightKg = positiveNumber(dimensions.pesoBruto) || positiveNumber(detail?.pesoBruto);
  const widthCm = positiveNumber(dimensions.largura) || positiveNumber(detail?.largura);
  const heightCm = positiveNumber(dimensions.altura) || positiveNumber(detail?.altura);
  const depthCm = positiveNumber(dimensions.profundidade) || positiveNumber(detail?.profundidade);

  return {
    weightKg: weightKg || undefined,
    dimensions: widthCm || heightCm || depthCm
      ? {
          width_cm: widthCm || undefined,
          height_cm: heightCm || undefined,
          depth_cm: depthCm || undefined,
        }
      : undefined,
  };
}

function resolveShopeeSyncDefaults(product, blingDetail) {
  const blingDescription = getBlingDescription(blingDetail);
  const localDescription = normalizeShopeeDescription(product?.description || product?.name || '');
  const physicalDefaults = getBlingPhysicalDefaults(blingDetail);

  return {
    description: blingDescription || localDescription,
    stock: parseStockValue(blingDetail?.stock_quantity ?? product?.stock_quantity ?? 0),
    ...physicalDefaults,
  };
}

export {
  getBlingPhysicalDefaults,
  getBlingDescription,
  normalizeShopeeDescription,
  parseStockValue,
  resolveShopeeSyncDefaults,
};
