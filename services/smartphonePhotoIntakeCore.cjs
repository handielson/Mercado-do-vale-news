'use strict';

const { normalizePhysicalRamValue } = require('./physicalRamCore.cjs');

const PHOTO_INTAKE_STATUS = Object.freeze({
  UPLOADED: 'uploaded',
  ANALYZING: 'analyzing',
  WAITING_MODEL_REGISTRATION: 'waiting_model_registration',
  WAITING_PRICE_CONFIRMATION: 'waiting_price_confirmation',
  REVIEW_REQUIRED: 'review_required',
  READY_TO_FINALIZE: 'ready_to_finalize',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const PHOTO_INTAKE_STATUS_LABEL = Object.freeze({
  [PHOTO_INTAKE_STATUS.UPLOADED]: 'Imagem recebida',
  [PHOTO_INTAKE_STATUS.ANALYZING]: 'Analisando imagem',
  [PHOTO_INTAKE_STATUS.WAITING_MODEL_REGISTRATION]: 'Esperando cadastrar modelo',
  [PHOTO_INTAKE_STATUS.WAITING_PRICE_CONFIRMATION]: 'Esperando confirmar preços',
  [PHOTO_INTAKE_STATUS.REVIEW_REQUIRED]: 'Revisar leitura',
  [PHOTO_INTAKE_STATUS.READY_TO_FINALIZE]: 'Pronto para salvar',
  [PHOTO_INTAKE_STATUS.COMPLETED]: 'Disponível para venda',
  [PHOTO_INTAKE_STATUS.FAILED]: 'Erro na leitura',
  [PHOTO_INTAKE_STATUS.CANCELLED]: 'Cancelado',
});

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdentifier(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeSerial(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normalizeMemory(value) {
  const compact = String(value || '').replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(\d+)(GB|G|TB|T)$/);
  if (!match) return compact;
  return `${match[1]}${match[2].startsWith('T') ? 'TB' : 'GB'}`;
}

function buildSmartphoneVariantSkuBase({ modelName, ram, storage, color } = {}) {
  const modelCode = normalizeText(modelName)
    .split(' ')
    .filter(Boolean)
    .map((token) => {
      const letters = token.replace(/\d/g, '');
      const digits = token.replace(/\D/g, '');
      return `${letters ? letters[0] : ''}${digits}`;
    })
    .join('');
  const ramCode = normalizePhysicalRamValue(ram).replace(/\D/g, '');
  const storageCode = normalizeMemory(storage).replace(/\D/g, '');
  const colorCode = normalizeText(color)
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0])
    .join('');
  return `${modelCode || 'smartphone'}${ramCode}${storageCode}${colorCode}`
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 48);
}

const COLOR_TRANSLATIONS_PT_BR = Object.freeze({
  black: 'Preto',
  'midnight black': 'Preto',
  'matte black': 'Preto Fosco',
  white: 'Branco',
  purple: 'Roxo',
  violet: 'Violeta',
  lavender: 'Lavanda',
  blue: 'Azul',
  green: 'Verde',
  yellow: 'Amarelo',
  orange: 'Laranja',
  red: 'Vermelho',
  pink: 'Rosa',
  silver: 'Prata',
  gray: 'Cinza',
  grey: 'Cinza',
  graphite: 'Grafite',
  gold: 'Dourado',
  golden: 'Dourado',
  titanium: 'Titânio',
  champagne: 'Champagne',
  coral: 'Coral',
  bronze: 'Bronze',
  copper: 'Cobre',
  beige: 'Bege',
});

function translateColorToPtBr(value) {
  const original = String(value || '').trim();
  if (!original) return '';
  return COLOR_TRANSLATIONS_PT_BR[normalizeText(original)] || original;
}

function isValidLuhn(value) {
  const digits = normalizeIdentifier(value);
  if (!digits) return false;
  let sum = 0;
  let doubleNext = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleNext) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

function isValidImei(value) {
  const digits = normalizeIdentifier(value);
  return /^\d{15}$/.test(digits) && isValidLuhn(digits);
}

function isValidGtin(value) {
  const digits = normalizeIdentifier(value);
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const checkDigit = Number(digits.at(-1));
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function normalizePhotoExtraction(raw = {}) {
  return {
    brand: String(raw.brand || raw.marca || '').trim(),
    model: String(raw.model || raw.modelo || '').trim(),
    color: translateColorToPtBr(raw.color || raw.cor),
    ram: normalizePhysicalRamValue(raw.ram),
    storage: normalizeMemory(raw.storage || raw.armazenamento),
    serial: normalizeSerial(raw.serial || raw.sn),
    imei1: normalizeIdentifier(raw.imei1 || raw.imei_1),
    imei2: normalizeIdentifier(raw.imei2 || raw.imei_2),
    ean: normalizeIdentifier(raw.ean || raw.gtin),
    product_code: String(raw.product_code || raw.codigo_produto || '').trim(),
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : null,
  };
}

function validatePhotoExtraction(raw = {}) {
  const value = normalizePhotoExtraction(raw);
  const errors = [];
  const warnings = [];
  if (!value.brand) errors.push({ field: 'brand', code: 'required', message: 'Marca não identificada' });
  if (!value.model) errors.push({ field: 'model', code: 'required', message: 'Modelo não identificado' });
  if (!value.color) warnings.push({ field: 'color', code: 'missing', message: 'Cor precisa ser conferida' });
  if (!value.ram) warnings.push({ field: 'ram', code: 'missing', message: 'Memória RAM precisa ser conferida' });
  if (!value.storage) warnings.push({ field: 'storage', code: 'missing', message: 'Armazenamento precisa ser conferido' });
  if (!value.serial) errors.push({ field: 'serial', code: 'required', message: 'Número de série não identificado' });
  if (!value.imei1) errors.push({ field: 'imei1', code: 'required', message: 'IMEI 1 não identificado' });
  else if (!isValidImei(value.imei1)) errors.push({ field: 'imei1', code: 'invalid', message: 'IMEI 1 inválido' });
  if (value.imei2 && !isValidImei(value.imei2)) errors.push({ field: 'imei2', code: 'invalid', message: 'IMEI 2 inválido' });
  if (value.ean && !isValidGtin(value.ean)) warnings.push({ field: 'ean', code: 'invalid', message: 'EAN precisa ser conferido' });
  if (value.imei1 && value.imei2 && value.imei1 === value.imei2) {
    errors.push({ field: 'imei2', code: 'duplicate', message: 'IMEI 1 e IMEI 2 não podem ser iguais' });
  }
  return { value, errors, warnings, valid: errors.length === 0 };
}

function isManuallyConfirmablePhotoIntakeIssue(issue = {}) {
  return !['required', 'duplicate', 'already_registered'].includes(String(issue.code || '').trim());
}

function getBlockingPhotoIntakeErrors(validationErrors = [], reviewConfirmed = false) {
  const errors = Array.isArray(validationErrors) ? validationErrors : [];
  if (!reviewConfirmed) return errors;
  return errors.filter((issue) => !isManuallyConfirmablePhotoIntakeIssue(issue));
}

function resolvePhotoIntakeStatus({ validationErrors = [], validationWarnings = [], reviewConfirmed = false, matchedModelId = null, pricesConfirmed = false } = {}) {
  if (getBlockingPhotoIntakeErrors(validationErrors, reviewConfirmed).length > 0) return PHOTO_INTAKE_STATUS.REVIEW_REQUIRED;
  if (!reviewConfirmed && (validationErrors.length > 0 || validationWarnings.length > 0)) return PHOTO_INTAKE_STATUS.REVIEW_REQUIRED;
  if (!matchedModelId) return PHOTO_INTAKE_STATUS.WAITING_MODEL_REGISTRATION;
  if (!pricesConfirmed) return PHOTO_INTAKE_STATUS.WAITING_PRICE_CONFIRMATION;
  return PHOTO_INTAKE_STATUS.READY_TO_FINALIZE;
}

function calculateBrandPrices(costCents, margins = {}) {
  const cost = Math.max(0, Math.round(Number(costCents) || 0));
  return {
    price_cost: cost,
    price_retail: cost + Math.max(0, Math.round(Number(margins.retail_margin_cents) || 0)),
    price_reseller: cost + Math.max(0, Math.round(Number(margins.reseller_margin_cents) || 0)),
    price_wholesale: cost + Math.max(0, Math.round(Number(margins.wholesale_margin_cents) || 0)),
  };
}

function isAffirmativeFeature(value) {
  if (value === true || value === 1) return true;
  return normalizeText(value) === 'sim';
}

function getProductSpec(product, keys) {
  const specs = product?.specs && typeof product.specs === 'object' ? product.specs : {};
  const customFields = product?.custom_fields && typeof product.custom_fields === 'object' ? product.custom_fields : {};
  for (const key of keys) {
    if (specs[key] !== undefined && specs[key] !== null && specs[key] !== '') return specs[key];
    if (customFields[key] !== undefined && customFields[key] !== null && customFields[key] !== '') return customFields[key];
  }
  return '';
}

function getSmartphoneConfigurationKey(product) {
  const modelKey = String(product?.model_id || `${normalizeText(product?.brand || product?.brand_name)}:${normalizeText(product?.name || product?.sku || product?.id)}`);
  const ram = normalizeMemory(getProductSpec(product, ['ram', 'memoria_ram', 'memory_ram']));
  const storage = normalizeMemory(getProductSpec(product, ['storage', 'armazenamento', 'memoria', 'capacity']));
  const color = normalizeText(getProductSpec(product, ['color', 'cor', 'colour']));
  return [modelKey, ram, storage, color].join('|');
}

function getSmartphoneSaleConfigurationKey(product) {
  const modelKey = String(product?.model_id || `${normalizeText(product?.brand || product?.brand_name)}:${normalizeText(product?.name || product?.sku || product?.id)}`);
  const ram = normalizePhysicalRamValue(getProductSpec(product, ['ram_fisica', 'memoria_ram_fisica', 'ram', 'memoria_ram', 'memory_ram']));
  const storage = normalizeMemory(getProductSpec(product, ['storage', 'armazenamento', 'memoria', 'capacity']));
  return [modelKey, ram, storage].join('|');
}

function findConflictingNfcConfigurations(products) {
  const valuesByConfiguration = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const key = getSmartphoneConfigurationKey(product);
    const value = normalizeText(getProductSpec(product, ['nfc', 'NFC'])) || 'vazio';
    if (!valuesByConfiguration.has(key)) valuesByConfiguration.set(key, new Set());
    valuesByConfiguration.get(key).add(value);
  }
  return new Set(
    [...valuesByConfiguration.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([key]) => key)
  );
}

function filterSmartphonesByFeatures(products, filters = {}) {
  const wantedBrand = normalizeText(filters.brand);
  const wantedRam = normalizePhysicalRamValue(filters.ram);
  const wantedStorage = normalizeMemory(filters.storage);
  const nfcRequired = filters.nfc === true;
  const minPrice = Number(filters.min_price_cents || 0);
  const maxPrice = Number(filters.max_price_cents || 0);
  const conflictingNfcConfigurations = nfcRequired ? findConflictingNfcConfigurations(products) : new Set();
  return (Array.isArray(products) ? products : []).filter((product) => {
    if (String(product?.status || 'active') !== 'active') return false;
    if (Number(product?.stock_quantity || 0) <= 0) return false;
    if (wantedBrand && !normalizeText(product?.brand || product?.brand_name).includes(wantedBrand)) return false;
    if (wantedRam && normalizePhysicalRamValue(getProductSpec(product, ['ram_fisica', 'memoria_ram_fisica', 'ram', 'memoria_ram', 'memory_ram'])) !== wantedRam) return false;
    if (wantedStorage && normalizeMemory(getProductSpec(product, ['storage', 'armazenamento', 'memoria', 'capacity'])) !== wantedStorage) return false;
    if (nfcRequired && conflictingNfcConfigurations.has(getSmartphoneConfigurationKey(product))) return false;
    if (nfcRequired && !isAffirmativeFeature(getProductSpec(product, ['nfc', 'NFC']))) return false;
    const price = Number(product?.price_retail || product?.price_pix || 0);
    if (minPrice > 0 && price < minPrice) return false;
    if (maxPrice > 0 && price > maxPrice) return false;
    return true;
  });
}

module.exports = {
  PHOTO_INTAKE_STATUS,
  PHOTO_INTAKE_STATUS_LABEL,
  buildSmartphoneVariantSkuBase,
  calculateBrandPrices,
  getBlockingPhotoIntakeErrors,
  filterSmartphonesByFeatures,
  findConflictingNfcConfigurations,
  getSmartphoneSaleConfigurationKey,
  isAffirmativeFeature,
  isValidGtin,
  isValidImei,
  isManuallyConfirmablePhotoIntakeIssue,
  normalizeMemory,
  normalizePhotoExtraction,
  resolvePhotoIntakeStatus,
  translateColorToPtBr,
  validatePhotoExtraction,
};
