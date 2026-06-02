import { getCategoryDynamicSpecFields } from '../components/products/sections/categorySpecFieldCore.js';

export const BULK_IMPORT_BASE_HEADERS = [
  'acao',
  'sku',
  'nome',
  'modelo_id',
  'modelo_nome',
  'categoria_id',
  'categoria_nome',
  'marca',
  'ean',
  'status',
  'estoque',
  'controlar_estoque',
  'preco_custo',
  'preco_varejo',
  'preco_revenda',
  'preco_atacado',
  'preco_promocional',
  'promocao_inicio',
  'promocao_fim',
  'ncm',
  'cest',
  'origem',
  'peso_kg',
  'largura_cm',
  'altura_cm',
  'profundidade_cm',
  'garantia_tipo',
  'garantia_template_id',
  'bling_id',
  'bling_parent_id',
  'shopee_item_id',
  'descricao',
  'meta_titulo',
  'meta_descricao',
  'palavras_chave',
  'video_url',
];

const PRODUCT_SPEC_FIELD_ORDER = [
  'imei1',
  'imei2',
  'serial',
  'color',
  'ram',
  'storage',
  'version',
  'battery_health',
];

const REQUIRED_PRICE_FIELDS = [
  'price_cost',
  'price_retail',
  'price_reseller',
  'price_wholesale',
];

const SERIALIZED_SPEC_FIELDS = ['imei1', 'imei2', 'serial'];
const VALID_STATUSES = new Set(['active', 'inactive', 'out_of_stock', 'discontinued']);

const HEADER_ALIASES = new Map([
  ['acao', 'action'],
  ['action', 'action'],
  ['sku', 'sku'],
  ['nome', 'name'],
  ['name', 'name'],
  ['modelo_id', 'model_id'],
  ['model_id', 'model_id'],
  ['modelo_nome', 'model_name'],
  ['model_name', 'model_name'],
  ['categoria_id', 'category_id'],
  ['category_id', 'category_id'],
  ['categoria_nome', 'category_name'],
  ['category_name', 'category_name'],
  ['marca', 'brand'],
  ['brand', 'brand'],
  ['ean', 'ean'],
  ['status', 'status'],
  ['estoque', 'stock_quantity'],
  ['stock_quantity', 'stock_quantity'],
  ['controlar_estoque', 'track_inventory'],
  ['track_inventory', 'track_inventory'],
  ['preco_custo', 'price_cost'],
  ['price_cost', 'price_cost'],
  ['preco_varejo', 'price_retail'],
  ['price_retail', 'price_retail'],
  ['preco_revenda', 'price_reseller'],
  ['price_reseller', 'price_reseller'],
  ['preco_atacado', 'price_wholesale'],
  ['price_wholesale', 'price_wholesale'],
  ['preco_promocional', 'price_promo'],
  ['price_promo', 'price_promo'],
  ['promocao_inicio', 'promo_start'],
  ['promo_start', 'promo_start'],
  ['promocao_fim', 'promo_end'],
  ['promo_end', 'promo_end'],
  ['ncm', 'ncm'],
  ['cest', 'cest'],
  ['origem', 'origin'],
  ['origin', 'origin'],
  ['peso_kg', 'weight_kg'],
  ['weight_kg', 'weight_kg'],
  ['largura_cm', 'width_cm'],
  ['width_cm', 'width_cm'],
  ['altura_cm', 'height_cm'],
  ['height_cm', 'height_cm'],
  ['profundidade_cm', 'depth_cm'],
  ['depth_cm', 'depth_cm'],
  ['garantia_tipo', 'warranty_type'],
  ['warranty_type', 'warranty_type'],
  ['garantia_template_id', 'warranty_template_id'],
  ['warranty_template_id', 'warranty_template_id'],
  ['bling_id', 'bling_id'],
  ['bling_parent_id', 'bling_parent_id'],
  ['shopee_item_id', 'shopee_item_id'],
  ['descricao', 'description'],
  ['description', 'description'],
  ['meta_titulo', 'meta_title'],
  ['meta_title', 'meta_title'],
  ['meta_descricao', 'meta_description'],
  ['meta_description', 'meta_description'],
  ['palavras_chave', 'keywords'],
  ['keywords', 'keywords'],
  ['video_url', 'video_url'],
  ['imei_1', 'specs.imei1'],
  ['imei1', 'specs.imei1'],
  ['imei_2', 'specs.imei2'],
  ['imei2', 'specs.imei2'],
  ['serial', 'specs.serial'],
]);

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeHeaderKey(key) {
  const raw = stripAccents(key).toLowerCase().trim();
  const dotted = raw
    .replace(/^specs[\s._-]+/, 'specs.')
    .replace(/^spec[\s._-]+/, 'specs.');
  if (dotted.startsWith('specs.')) {
    return `specs.${dotted.slice('specs.'.length).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
  }
  return raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function canonicalKey(key) {
  const normalized = normalizeHeaderKey(key);
  return HEADER_ALIASES.get(normalized) || normalized;
}

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function textValue(value) {
  if (isBlank(value)) return '';
  return String(value).trim();
}

function upperTextValue(value) {
  return textValue(value).toUpperCase();
}

function normalizeAction(value) {
  const action = stripAccents(value).toLowerCase().trim();
  if (['criar', 'create', 'novo', 'new'].includes(action)) return 'create';
  if (['atualizar', 'update', 'editar', 'edit'].includes(action)) return 'update';
  if (['ignorar', 'skip'].includes(action)) return 'skip';
  if (action === 'upsert') return 'upsert';
  return '';
}

function normalizeWarrantyType(value) {
  const warranty = stripAccents(value).toLowerCase().trim();
  if (['marca', 'brand'].includes(warranty)) return 'brand';
  if (['categoria', 'category'].includes(warranty)) return 'category';
  if (['custom', 'personalizada', 'diferenciada'].includes(warranty)) return 'custom';
  return warranty || '';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = stripAccents(value).toLowerCase().trim();
  if (['1', 'sim', 's', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'nao', 'n', 'false', 'no'].includes(normalized)) return false;
  return undefined;
}

function normalizeMoneyToCents(value) {
  if (isBlank(value)) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);

  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '');
  if (!raw) return undefined;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function normalizeInteger(value) {
  if (isBlank(value)) return undefined;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function normalizeNumber(value) {
  if (isBlank(value)) return undefined;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  if (isBlank(value)) return undefined;
  return String(value).split(',').map(textValue).filter(Boolean);
}

function normalizeBlingId(value) {
  if (isBlank(value)) return undefined;
  const parsed = normalizeInteger(value);
  return parsed == null ? undefined : parsed;
}

function appendUnique(target, value) {
  if (!value || target.includes(value)) return;
  target.push(value);
}

export function buildBulkProductTemplateHeaders({ categoryConfig = {} } = {}) {
  const headers = [...BULK_IMPORT_BASE_HEADERS];
  const specKeys = [];

  for (const key of PRODUCT_SPEC_FIELD_ORDER) {
    const requirement = categoryConfig?.[key];
    if (typeof requirement === 'string' && requirement !== 'off' && requirement !== 'hidden') {
      appendUnique(specKeys, key);
    }
  }

  for (const field of getCategoryDynamicSpecFields(categoryConfig)) {
    appendUnique(specKeys, field.key);
  }

  return [
    ...headers,
    ...specKeys.map((key) => `specs.${key}`),
  ];
}

function exampleValueForHeader(header, category = null) {
  const examples = {
    acao: 'upsert',
    sku: 'SKU-EXEMPLO-001',
    nome: 'Produto exemplo',
    modelo_id: 'modelo-id-vps',
    modelo_nome: 'Modelo exemplo',
    categoria_id: category?.id || 'categoria-id-vps',
    categoria_nome: category?.name || 'Categoria exemplo',
    marca: 'Marca exemplo',
    ean: '7891234567890',
    status: 'active',
    estoque: 1,
    controlar_estoque: 'sim',
    preco_custo: '100,00',
    preco_varejo: '150,00',
    preco_revenda: '140,00',
    preco_atacado: '130,00',
    preco_promocional: '',
    promocao_inicio: '',
    promocao_fim: '',
    ncm: '85176259',
    cest: '',
    origem: '0',
    peso_kg: '0,500',
    largura_cm: 10,
    altura_cm: 5,
    profundidade_cm: 15,
    garantia_tipo: 'marca',
    garantia_template_id: '',
    bling_id: '',
    bling_parent_id: '',
    shopee_item_id: '',
    descricao: 'Descricao exemplo do produto.',
    meta_titulo: 'Produto exemplo',
    meta_descricao: 'Meta descricao exemplo.',
    palavras_chave: 'produto, exemplo',
    video_url: '',
    'specs.serial': 'SN123456789',
    'specs.imei1': '123456789012345',
    'specs.imei2': '987654321098765',
    'specs.color': 'Preto',
    'specs.ram': '8GB',
    'specs.storage': '256GB',
    'specs.version': 'Global',
    'specs.battery_health': '100',
  };

  if (Object.prototype.hasOwnProperty.call(examples, header)) {
    return examples[header];
  }

  if (header.startsWith('specs.')) {
    return `Exemplo ${header.slice('specs.'.length)}`;
  }

  return '';
}

export function buildBulkProductTemplateExampleRows({ category = null, categoryConfig = {} } = {}) {
  const headers = buildBulkProductTemplateHeaders({ categoryConfig });
  return [
    headers.reduce((row, header) => {
      row[header] = exampleValueForHeader(header, category);
      return row;
    }, {}),
  ];
}

export function normalizeBulkImportRow(row = {}) {
  const normalized = {
    raw: row,
    specs: {},
  };

  for (const [key, value] of Object.entries(row || {})) {
    const canonical = canonicalKey(key);
    if (!canonical) continue;

    if (canonical.startsWith('specs.')) {
      const specKey = canonical.slice('specs.'.length);
      if (!specKey || isBlank(value)) continue;
      normalized.specs[specKey] = textValue(value);
      continue;
    }

    if (isBlank(value)) {
      normalized[canonical] = undefined;
      continue;
    }

    switch (canonical) {
      case 'action':
        normalized.action = normalizeAction(value);
        break;
      case 'sku':
        normalized.sku = upperTextValue(value);
        break;
      case 'ean':
        normalized.ean = textValue(value).replace(/\D/g, '');
        break;
      case 'price_cost':
      case 'price_retail':
      case 'price_reseller':
      case 'price_wholesale':
      case 'price_promo':
        normalized[canonical] = normalizeMoneyToCents(value);
        break;
      case 'stock_quantity':
      case 'bling_id':
      case 'bling_parent_id':
      case 'shopee_item_id':
        normalized[canonical] = normalizeBlingId(value);
        break;
      case 'track_inventory':
        normalized.track_inventory = normalizeBoolean(value);
        break;
      case 'width_cm':
      case 'height_cm':
      case 'depth_cm':
      case 'weight_kg':
        normalized[canonical] = normalizeNumber(value);
        break;
      case 'warranty_type':
        normalized.warranty_type = normalizeWarrantyType(value);
        break;
      case 'keywords':
        normalized.keywords = normalizeKeywords(value);
        break;
      case 'status':
        normalized.status = stripAccents(value).toLowerCase().trim();
        break;
      default:
        normalized[canonical] = textValue(value);
    }
  }

  if (normalized.specs.imei1) normalized.imei1 = normalized.specs.imei1;
  if (normalized.specs.imei2) normalized.imei2 = normalized.specs.imei2;
  if (normalized.specs.serial) normalized.serial = normalized.specs.serial;

  return normalized;
}

export function normalizeBulkImportRows(rows = []) {
  return rows.map((row) => normalizeBulkImportRow(row));
}

function validationError(code, message, debug = {}) {
  return { code, message, debug };
}

function requiredSpecKeys(categoryConfig = {}) {
  const keys = [];
  for (const key of PRODUCT_SPEC_FIELD_ORDER) {
    if (categoryConfig?.[key] === 'required') appendUnique(keys, key);
  }
  for (const field of getCategoryDynamicSpecFields(categoryConfig)) {
    if (field.requirement === 'required') appendUnique(keys, field.key);
  }
  return keys;
}

function getExistingProduct(existingProductsBySku, sku) {
  if (!sku || !existingProductsBySku) return null;
  return existingProductsBySku.get(sku) || existingProductsBySku.get(String(sku).toUpperCase()) || null;
}

export function validateBulkImportRows(rows = [], context = {}) {
  const categoryConfig = context.categoryConfig || {};
  const requiredSpecs = requiredSpecKeys(categoryConfig);
  const seenSku = new Map();
  const seenSerialized = new Map();

  return rows.map((row, index) => {
    const errors = [];
    const warnings = [];
    const rowNumber = index + 1;
    const existingProduct = getExistingProduct(context.existingProductsBySku, row.sku);
    const action = row.action || 'upsert';
    const requiresCreateFields = !existingProduct && action !== 'update';

    if (!row.sku) {
      errors.push(validationError('required_sku', 'SKU e obrigatorio.'));
    } else {
      const previousSku = seenSku.get(row.sku);
      if (previousSku) {
        errors.push(validationError('duplicate_batch_sku', `SKU duplicado no lote: ${row.sku}`, {
          firstRow: previousSku,
          currentRow: rowNumber,
        }));
      } else {
        seenSku.set(row.sku, rowNumber);
      }
    }

    if (requiresCreateFields) {
      if (!row.name) errors.push(validationError('required_name', 'Nome e obrigatorio para produto novo.'));
      if (!row.model_id) errors.push(validationError('required_model', 'Modelo e obrigatorio para produto novo.'));
      if (!row.category_id) errors.push(validationError('required_category', 'Categoria e obrigatoria para produto novo.'));
    }

    for (const priceField of REQUIRED_PRICE_FIELDS) {
      if (row[priceField] == null) {
        errors.push(validationError('required_price', `${priceField} e obrigatorio.`, { field: priceField }));
      }
    }

    if (row.status && !VALID_STATUSES.has(row.status)) {
      errors.push(validationError('invalid_status', `Status invalido: ${row.status}`, { value: row.status }));
    }

    for (const specKey of requiredSpecs) {
      if (!row.specs?.[specKey]) {
        errors.push(validationError('required_spec', `Campo specs.${specKey} e obrigatorio.`, { field: specKey }));
      }
    }

    for (const imeiKey of ['imei1', 'imei2']) {
      const value = row.specs?.[imeiKey];
      if (value && !/^\d{15}$/.test(String(value))) {
        errors.push(validationError('invalid_imei', `${imeiKey} deve ter 15 digitos.`, { field: imeiKey, value }));
      }
    }

    for (const field of SERIALIZED_SPEC_FIELDS) {
      const value = row.specs?.[field];
      if (!value) continue;
      const duplicateKey = `${field}:${String(value).trim().toLowerCase()}`;
      const previous = seenSerialized.get(duplicateKey);
      if (previous) {
        errors.push(validationError('duplicate_batch_serialized_identifier', `${field} duplicado no lote: ${value}`, {
          field,
          value,
          firstRow: previous,
          currentRow: rowNumber,
        }));
      } else {
        seenSerialized.set(duplicateKey, rowNumber);
      }
    }

    if (existingProduct) {
      warnings.push({
        code: 'existing_sku',
        message: `SKU ja existe: ${row.sku}`,
        debug: { productId: existingProduct.id, sku: row.sku },
      });
    }

    return {
      row: rowNumber,
      sku: row.sku || '',
      valid: errors.length === 0,
      errors,
      warnings,
      existingProduct,
    };
  });
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim?.() !== '';
}

function assignIfPresent(target, key, value, mode) {
  if (mode === 'filled_only' && !hasValue(value)) return;
  target[key] = value ?? null;
}

export function buildBulkImportPayload(row, existingProduct = null, options = {}) {
  const updateMode = options.updateMode || 'filled_only';
  const preserveImages = options.preserveImages !== false;
  const base = existingProduct ? { ...existingProduct } : {};
  const payload = { ...base };

  assignIfPresent(payload, 'model_id', row.model_id, updateMode);
  assignIfPresent(payload, 'model', row.model_name, updateMode);
  assignIfPresent(payload, 'category_id', row.category_id, updateMode);
  assignIfPresent(payload, 'brand', row.brand, updateMode);
  assignIfPresent(payload, 'name', row.name, updateMode);
  assignIfPresent(payload, 'sku', row.sku, updateMode);
  assignIfPresent(payload, 'status', row.status, updateMode);
  assignIfPresent(payload, 'stock_quantity', row.stock_quantity, updateMode);
  assignIfPresent(payload, 'track_inventory', row.track_inventory, updateMode);
  assignIfPresent(payload, 'price_cost', row.price_cost, updateMode);
  assignIfPresent(payload, 'price_retail', row.price_retail, updateMode);
  assignIfPresent(payload, 'price_reseller', row.price_reseller, updateMode);
  assignIfPresent(payload, 'price_wholesale', row.price_wholesale, updateMode);
  assignIfPresent(payload, 'price_promo', row.price_promo, updateMode);
  assignIfPresent(payload, 'promo_start', row.promo_start, updateMode);
  assignIfPresent(payload, 'promo_end', row.promo_end, updateMode);
  assignIfPresent(payload, 'ncm', row.ncm, updateMode);
  assignIfPresent(payload, 'cest', row.cest, updateMode);
  assignIfPresent(payload, 'origin', row.origin, updateMode);
  assignIfPresent(payload, 'warranty_type', row.warranty_type, updateMode);
  assignIfPresent(payload, 'warranty_template_id', row.warranty_template_id, updateMode);
  assignIfPresent(payload, 'bling_id', row.bling_id, updateMode);
  assignIfPresent(payload, 'bling_parent_id', row.bling_parent_id, updateMode);
  assignIfPresent(payload, 'shopee_item_id', row.shopee_item_id, updateMode);
  assignIfPresent(payload, 'description', row.description, updateMode);
  assignIfPresent(payload, 'meta_title', row.meta_title, updateMode);
  assignIfPresent(payload, 'meta_description', row.meta_description, updateMode);
  assignIfPresent(payload, 'keywords', row.keywords, updateMode);
  assignIfPresent(payload, 'video_url', row.video_url, updateMode);

  if (row.ean) {
    payload.eans = [row.ean];
  } else if (!payload.eans && existingProduct?.eans) {
    payload.eans = existingProduct.eans;
  }

  const dimensions = { ...(existingProduct?.dimensions || {}) };
  if (hasValue(row.width_cm)) dimensions.width_cm = row.width_cm;
  if (hasValue(row.height_cm)) dimensions.height_cm = row.height_cm;
  if (hasValue(row.depth_cm)) dimensions.depth_cm = row.depth_cm;
  if (Object.keys(dimensions).length > 0) payload.dimensions = dimensions;
  assignIfPresent(payload, 'weight_kg', row.weight_kg, updateMode);

  payload.specs = {
    ...(existingProduct?.specs || {}),
    ...(row.specs || {}),
  };

  if (preserveImages && existingProduct) {
    payload.images = existingProduct.images || [];
  } else if (!payload.images) {
    payload.images = [];
  }

  return payload;
}

export function buildBulkImportPlan(rows = [], context = {}, options = {}) {
  const validations = validateBulkImportRows(rows, context);
  const updateExisting = Boolean(options.updateExisting);
  const items = rows.map((row, index) => {
    const validation = validations[index];
    const existingProduct = validation.existingProduct;
    let action = 'create';
    const debug = {};

    if (!validation.valid) {
      action = 'error';
      debug.reason = 'validation_failed';
    } else if (existingProduct) {
      if (row.action === 'create') {
        action = 'error';
        debug.reason = 'existing_sku_create_requested';
      } else if (updateExisting || row.action === 'update') {
        action = 'update';
      } else {
        action = 'skip';
        debug.reason = 'existing_sku_update_disabled';
      }
    } else if (row.action === 'update') {
      action = 'error';
      debug.reason = 'missing_existing_product_for_update';
    }

    const payload = action === 'create' || action === 'update'
      ? buildBulkImportPayload(row, existingProduct, {
        updateMode: options.updateMode || 'filled_only',
        preserveImages: true,
      })
      : null;

    return {
      row: index + 1,
      sku: row.sku || '',
      action,
      rowData: row,
      existingProduct,
      payload,
      validation,
      debug,
    };
  });

  return {
    total: rows.length,
    create: items.filter((item) => item.action === 'create').length,
    update: items.filter((item) => item.action === 'update').length,
    skip: items.filter((item) => item.action === 'skip').length,
    error: items.filter((item) => item.action === 'error').length,
    items,
  };
}
