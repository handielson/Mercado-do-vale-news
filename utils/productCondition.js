// product-condition-v1: regra única de condição do produto (admin, site e robô).
// Valor gravado em specs.condition: new | seminovo | used | open_box. Observação em specs.condition_note.
export const PRODUCT_CONDITIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'seminovo', label: 'Seminovo' },
  { value: 'used', label: 'Usado' },
  { value: 'open_box', label: 'Caixa aberta' },
];

const LABELS = Object.fromEntries(PRODUCT_CONDITIONS.map((item) => [item.value, item.label]));
export const CONDITION_NOTE_MAX = 300;

function parseSpecs(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

export function normalizeProductCondition(value) {
  const text = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, ' ');
  if (!text || text === 'new' || text === 'novo' || text === 'lacrado') return 'new';
  if (text === 'seminovo' || text === 'semi novo' || text === 'refurbished' || text === 'recondicionado') return 'seminovo';
  if (text === 'used' || text === 'usado') return 'used';
  if (text === 'open box' || text === 'caixa aberta' || text === 'vitrine') return 'open_box';
  return 'new';
}

/** Condição de um produto (aceita o produto inteiro ou só specs). */
export function productCondition(productOrSpecs) {
  const specs = parseSpecs(productOrSpecs?.specs ?? productOrSpecs);
  return normalizeProductCondition(specs.condition ?? specs.condicao ?? productOrSpecs?.condition);
}

export function productConditionLabel(condition) {
  return LABELS[normalizeProductCondition(condition)] || 'Novo';
}

export function isNotNewCondition(condition) {
  return normalizeProductCondition(condition) !== 'new';
}

/** Observação da condição (ex.: troca de peça em assistência); vazia para produto novo. */
export function productConditionNote(productOrSpecs) {
  if (!isNotNewCondition(productCondition(productOrSpecs))) return '';
  const specs = parseSpecs(productOrSpecs?.specs ?? productOrSpecs);
  return String(specs.condition_note || '').replace(/\s+/g, ' ').trim().slice(0, CONDITION_NOTE_MAX);
}
