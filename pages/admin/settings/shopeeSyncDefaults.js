import { normalizeShopeeDescription } from '../../../services/shopeeDescription.js';

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
