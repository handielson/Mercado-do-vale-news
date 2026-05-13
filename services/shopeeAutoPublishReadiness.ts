import type { ShopeeTemplate } from '../types/shopee-template';
import {
  analyzeShopeeTitleSafety,
  applyShopeeTemplateToProduct,
  resolveBestShopeeTemplate,
} from './shopeeTemplateEngine';

export type ShopeeAutoPublishReadinessStatus = 'ready' | 'review';
export type ShopeeAutoPublishIssueLevel = 'blocker' | 'warning';

export interface ShopeeAutoPublishProduct {
  id?: string;
  product_id?: string;
  status?: string;
  name?: string | null;
  sku?: string | null;
  images?: unknown[] | null;
  price_retail?: number | null;
  stock_quantity?: number | null;
  track_inventory?: boolean | null;
  eans?: string[] | null;
  dimensions?: {
    width_cm?: number | null;
    height_cm?: number | null;
    depth_cm?: number | null;
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    largura?: number | null;
    altura?: number | null;
    comprimento?: number | null;
    profundidade?: number | null;
  } | string | null;
  weight_kg?: number | null;
  shipping_weight?: number | null;
  shipping_length?: number | null;
  shipping_width?: number | null;
  shipping_height?: number | null;
  specs?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ShopeeAutoPublishIssue {
  level: ShopeeAutoPublishIssueLevel;
  code: string;
  message: string;
}

export interface ShopeeAutoPublishReadiness {
  productId: string;
  status: ShopeeAutoPublishReadinessStatus;
  template: ShopeeTemplate | null;
  finalTitle: string;
  blockers: ShopeeAutoPublishIssue[];
  warnings: ShopeeAutoPublishIssue[];
}

export interface ShopeeAutoPublishSummary {
  total: number;
  ready: number;
  review: number;
}

export interface ShopeeAutoPublishRequiredAttribute {
  attribute_id: number;
  label: string;
  mandatory?: boolean;
}

export interface ShopeeAutoPublishReadinessContext {
  requiredAttributesByCategoryId?: Record<string | number, ShopeeAutoPublishRequiredAttribute[]>;
  hasEnabledLogisticsChannel?: boolean | null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseDimensionObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function dimensionValue(dimensions: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = numberValue(dimensions[key]);
    if (value > 0) return value;
  }
  return 0;
}

function specsValue(specs: Record<string, unknown>, keys: string[]): number {
  const nestedDimensions = parseDimensionObject(specs.dimensions);
  for (const key of keys) {
    const direct = numberValue(specs[key]);
    if (direct > 0) return direct;

    const nested = numberValue(nestedDimensions[key]);
    if (nested > 0) return nested;
  }
  return 0;
}

function hasPositiveDimension(product: ShopeeAutoPublishProduct, template: ShopeeTemplate | null): boolean {
  if (template?.dimensionMode === 'fixed') {
    return numberValue(template.weightKg) > 0
      && numberValue(template.packageLength) > 0
      && numberValue(template.packageWidth) > 0
      && numberValue(template.packageHeight) > 0;
  }

  const dimensions = parseDimensionObject(product.dimensions);
  const specs = parseDimensionObject(product.specs);

  return numberValue(product.weight_kg) > 0
    || numberValue(product.shipping_weight) > 0
    || specsValue(specs, ['weight_kg', 'shipping_weight', 'dimensions.weight_kg', 'dimensions.shipping_weight']) > 0
    || numberValue(product.shipping_length) > 0
    || numberValue(product.shipping_width) > 0
    || numberValue(product.shipping_height) > 0
    || dimensionValue(dimensions, ['depth_cm', 'depth', 'length_cm', 'length', 'comprimento', 'profundidade']) > 0
    || dimensionValue(dimensions, ['width_cm', 'width', 'largura']) > 0
    || dimensionValue(dimensions, ['height_cm', 'height', 'altura']) > 0
    || specsValue(specs, ['dimensions.depth_cm', 'dimensions.depth', 'dimensions.length_cm', 'dimensions.length', 'dimensions.comprimento', 'dimensions.profundidade', 'depth_cm', 'depth', 'length_cm', 'length', 'comprimento', 'profundidade']) > 0
    || specsValue(specs, ['dimensions.width_cm', 'dimensions.width', 'dimensions.largura', 'width_cm', 'width', 'largura']) > 0
    || specsValue(specs, ['dimensions.height_cm', 'dimensions.height', 'dimensions.altura', 'height_cm', 'height', 'altura']) > 0;
}

function issue(code: string, message: string, level: ShopeeAutoPublishIssueLevel = 'blocker'): ShopeeAutoPublishIssue {
  return { code, message, level };
}

export function evaluateShopeeAutoPublishReadiness(
  product: ShopeeAutoPublishProduct,
  templates: ShopeeTemplate[],
  context: ShopeeAutoPublishReadinessContext = {},
): ShopeeAutoPublishReadiness {
  const blockers: ShopeeAutoPublishIssue[] = [];
  const warnings: ShopeeAutoPublishIssue[] = [];
  const template = resolveBestShopeeTemplate(product, templates);
  const applied = template ? applyShopeeTemplateToProduct(product, template) : null;
  const finalTitle = applied?.title || text(product.name);

  if (product.status && product.status !== 'not_synced') {
    blockers.push(issue('already_synced', 'Produto ja tem vinculo com a Shopee.'));
  }

  if (!template) {
    blockers.push(issue('missing_template', 'Sem template automatico compativel.'));
  }

  if (!text(product.sku)) {
    blockers.push(issue('missing_sku', 'SKU nao preenchido.'));
  }

  if (!Array.isArray(product.images) || product.images.filter(Boolean).length === 0) {
    blockers.push(issue('missing_image', 'Sem imagem principal.'));
  }

  if (numberValue(applied?.price ?? product.price_retail) <= 0) {
    blockers.push(issue('invalid_price', 'Preco invalido.'));
  }

  if (product.track_inventory !== false && numberValue(applied?.stock ?? product.stock_quantity) <= 0) {
    blockers.push(issue('invalid_stock', 'Estoque precisa ser maior que zero.'));
  }

  if (!applied?.categoryId) {
    blockers.push(issue('missing_category', 'Template sem categoria Shopee.'));
  }

  const requiredAttributes = applied?.categoryId
    ? context.requiredAttributesByCategoryId?.[applied.categoryId] || context.requiredAttributesByCategoryId?.[String(applied.categoryId)] || []
    : [];
  for (const attribute of requiredAttributes.filter((entry) => entry.mandatory !== false)) {
    const attributeValue = template?.attributeDefaults?.[attribute.attribute_id] || template?.attributeDefaults?.[String(attribute.attribute_id)];
    const hasValue = Array.isArray(attributeValue)
      ? attributeValue.some((value) => text(value))
      : text(attributeValue);
    if (!hasValue) {
      blockers.push(issue('missing_required_attribute', `Atributo obrigatorio ausente: ${attribute.label || attribute.attribute_id}.`));
    }
  }

  if (context.hasEnabledLogisticsChannel === false) {
    blockers.push(issue('missing_logistics_channel', 'Nenhum canal logistico habilitado para a loja.'));
  } else if (context.hasEnabledLogisticsChannel === null) {
    warnings.push(issue('logistics_not_checked', 'Logistica ainda nao validada.', 'warning'));
  }

  if (template && Object.keys(template.attributeDefaults || {}).length === 0) {
    warnings.push(issue('missing_attribute_defaults', 'Template sem atributos padrao.', 'warning'));
  }

  if (template) {
    const safety = analyzeShopeeTitleSafety(finalTitle, template.dangerousTerms || []);
    const sourceSafety = analyzeShopeeTitleSafety(text(product.name), template.dangerousTerms || []);
    if (safety.hasBlocks || sourceSafety.hasBlocks) {
      blockers.push(issue('blocked_title_term', 'Titulo contem termo bloqueado.'));
    } else if (safety.hasWarnings || sourceSafety.hasWarnings) {
      warnings.push(issue('warning_title_term', 'Titulo contem termo sensivel.', 'warning'));
    }
  }

  if (!hasPositiveDimension(product, template)) {
    warnings.push(issue('fallback_dimensions', 'Usara dimensoes seguras padrao no envio.', 'warning'));
  }

  if (applied?.gtinMode === 'blank' && (!Array.isArray(product.eans) || product.eans.filter(Boolean).length === 0)) {
    warnings.push(issue('missing_gtin', 'Sem GTIN/EAN; revise se o produto permite SEM GTIN.', 'warning'));
  }

  return {
    productId: text(product.product_id || product.id),
    status: blockers.length === 0 ? 'ready' : 'review',
    template,
    finalTitle,
    blockers,
    warnings,
  };
}

export function summarizeShopeeAutoPublishReadiness(
  items: ShopeeAutoPublishReadiness[],
): ShopeeAutoPublishSummary {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    review: items.filter((item) => item.status === 'review').length,
  };
}
