function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Canonical public family name for grouping, cards and product pages.
// The parent record owns the name; SKU and variation specs remain separate.
export function getCatalogFamilyName(product) {
  const isChild = Boolean(toCleanString(product?.parent_id));
  const isParent = Number(product?.is_parent) === 1;
  const familyName = isChild ? toCleanString(product?.parent_name) : isParent ? toCleanString(product?.name) : '';
  if (!familyName) return '';
  const sku = toCleanString(product?.sku);
  const familySku = isParent && !isChild ? sku : toCleanString(product?.parent_sku)
    || (/-\d+$/.test(sku) ? sku.replace(/-\d+$/, '') : '');
  if (!familySku) return familyName;
  const escapedSku = familySku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffix = new RegExp(String.raw`\s+[-–—]\s+${escapedSku}$`, 'i');
  return familyName.replace(suffix, '').trim() || familyName;
}

function normalizeKeyPart(value) {
  return toCleanString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateFamilySignature(product) {
  const specs = product?.specs || {};
  let baseName = toCleanString(product?.name || product?.model || 'unknown');
  const variantValues = [specs.color, specs.ram, specs.storage]
    .map(toCleanString)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const value of variantValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    baseName = baseName.replace(new RegExp(`(?:[,/\\s-]+)?${escaped}(?=$|[,/\\s-])`, 'ig'), ' ');
  }

  const commonColors = ['preto', 'preta', 'branco', 'branca', 'azul', 'vermelho', 'vermelha', 'rosa', 'verde', 'amarelo', 'amarela', 'cinza', 'prata', 'dourado', 'ouro', 'incolor', 'transparente', 'grafite', 'lilas', 'lilás', 'roxo', 'roxa'];
  const trailingColor = new RegExp(`(?:[,/\\s-]+)(?:${commonColors.join('|')})$`, 'i');
  baseName = baseName.replace(trailingColor, ' ');

  return `${normalizeKeyPart(product?.brand || 'unknown')}_${normalizeKeyPart(baseName)}`;
}

export function hasCatalogVariantSpecs(product) {
  const specs = product?.specs || {};
  return Boolean(
    toCleanString(specs.color) ||
    toCleanString(specs.ram) ||
    toCleanString(specs.storage)
  );
}

export function generateFallbackGroupKey(product) {
  const brand = product?.brand || 'unknown';
  let baseName = product?.name || product?.model || 'unknown';

  const lowerBase = String(baseName).toLowerCase();
  const color = toCleanString(product?.specs?.color).toLowerCase();
  const ram = toCleanString(product?.specs?.ram).toLowerCase();
  const storage = toCleanString(product?.specs?.storage).toLowerCase();

  if (color && lowerBase.endsWith(color)) {
    baseName = baseName.slice(0, -product.specs.color.length).trim();
  } else if (ram && lowerBase.endsWith(ram)) {
    baseName = baseName.slice(0, -product.specs.ram.length).trim();
  } else if (storage && lowerBase.endsWith(storage)) {
    baseName = baseName.slice(0, -product.specs.storage.length).trim();
  } else {
    const commonColors = ['preto', 'preta', 'branco', 'branca', 'azul', 'vermelho', 'vermelha', 'rosa', 'verde', 'amarelo', 'amarela', 'cinza', 'prata', 'dourado', 'ouro', 'incolor', 'transparente', 'grafite', 'lilas', 'lilás', 'roxo', 'roxa'];
    for (const commonColor of commonColors) {
      if (lowerBase.endsWith(commonColor) && lowerBase !== commonColor) {
        baseName = baseName.slice(0, -commonColor.length).trim();
        break;
      }
    }
  }

  if (baseName.endsWith('-')) {
    baseName = baseName.slice(0, -1).trim();
  }

  const model = baseName.replace(/^(o|a|os|as|um|uma)\s+/i, '');
  return `${brand}_${model}`.toLowerCase().replace(/\s+/g, '-');
}

export function generateCatalogGroupKey(product) {
  const explicitParentId = toCleanString(product?.parent_id);
  if (explicitParentId) {
    return `family:${explicitParentId}`;
  }

  const explicitProductId = toCleanString(product?.id);
  if (Number(product?.is_parent) === 1 && explicitProductId) {
    return `family:${explicitProductId}`;
  }

  if (product?.model_id && hasCatalogVariantSpecs(product)) {
    return `${product.model_id}_${generateFamilySignature(product)}`;
  }

  if (product?.model_id) {
    const skuOrId = toCleanString(product.sku) || toCleanString(product.id);
    if (skuOrId) {
      return `${product.model_id}_${skuOrId}`.toLowerCase().replace(/\s+/g, '-');
    }
  }

  return generateFallbackGroupKey(product);
}
