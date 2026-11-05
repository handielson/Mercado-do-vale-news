'use strict';
// Núcleo puro (sem banco) da entrada única: normalização, validação do lote e hash do plano.
const crypto = require('node:crypto');

const SOURCES = ['manual', 'bipar', 'planilha', 'foto', 'bling', 'atalho'];

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function isValidImei(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{15}$/.test(text)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = Number(text[14 - i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** undefined = vazio; inteiro >= 0 = valor; null = inválido. */
function cents(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null;
  const text = String(value).trim();
  if (text === '') return undefined;
  if (/^\d+(\.0+)?$/.test(text)) return Number(text.split('.')[0]);
  return null;
}

const text = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const orNull = (value) => { const t = text(value); return t === '' ? null : t; };
const serialOf = (value) => orNull(String(value ?? '').toUpperCase());

function normalizePrices(raw, errors) {
  if (!raw || typeof raw !== 'object') return null;
  const keys = ['price_retail', 'price_reseller', 'price_wholesale'];
  const out = {};
  let any = false;
  for (const key of keys) {
    const parsed = cents(raw[key]);
    if (parsed === undefined) { out[key] = null; continue; }
    any = true;
    if (parsed === null) { errors.push('Preço inválido.'); out[key] = null; continue; }
    out[key] = parsed;
  }
  return any ? out : null;
}

function normalizeEntryItem(raw, index) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const errors = [];
  const cfg = r.configuration && typeof r.configuration === 'object' ? r.configuration : {};
  const id = r.identity && typeof r.identity === 'object' ? r.identity : {};
  const source = String(r.source ?? '').trim();
  if (!SOURCES.includes(source)) errors.push('Origem inválida.');
  const quantity = r.quantity === undefined || r.quantity === null || r.quantity === '' ? 1 : Number(r.quantity);
  const battery = r.battery_health === undefined || r.battery_health === null || r.battery_health === '' ? null : Number(r.battery_health);
  const costParsed = cents(r.cost_cents);
  if (costParsed === null) errors.push('Custo inválido.');
  const prices = normalizePrices(r.prices, errors);
  return {
    line: index + 1,
    source,
    model_id: orNull(r.model_id),
    category_id: orNull(r.category_id),
    name: orNull(r.name),
    configuration: {
      ram: orNull(cfg.ram), storage: orNull(cfg.storage), version: orNull(cfg.version),
      network: orNull(cfg.network), condition: orNull(cfg.condition),
    },
    color: orNull(r.color),
    condition_note: orNull(r.condition_note),
    battery_health: Number.isFinite(battery) ? battery : null,
    identity: {
      imei1: onlyDigits(id.imei1) || null,
      imei2: onlyDigits(id.imei2) || null,
      serial: serialOf(id.serial),
    },
    quantity: Number.isFinite(quantity) ? quantity : 0,
    cost_cents: costParsed === undefined || costParsed === null ? null : costParsed,
    location_id: orNull(r.location_id),
    prices,
    photo_intake_id: orNull(r.photo_intake_id),
    bling: r.bling && typeof r.bling === 'object' ? r.bling : null,
    errors,
  };
}

function validateEntryBatch(items, { isSmartphone } = {}) {
  const out = items.map((item) => ({ ...item, errors: [...item.errors] }));
  const add = (item, message) => { if (!item.errors.includes(message)) item.errors.push(message); };
  const seen = new Map(); // imei -> linhas

  for (const item of out) {
    const phoneItem = typeof isSmartphone === 'function' ? Boolean(isSmartphone(item)) : false;
    if (!item.model_id && !(item.category_id && item.name)) add(item, 'Informe o modelo ou a categoria e o nome.');
    if (!item.location_id) add(item, 'Escolha o local de estoque.');

    if (phoneItem) {
      if (!item.identity.imei1 && !item.identity.serial) add(item, 'Informe IMEI 1 ou serial.');
      if (item.quantity !== 1) add(item, 'Celular entra um aparelho por linha.');
    } else if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      add(item, 'Quantidade deve ser 1 ou mais.');
    }

    if (item.identity.imei1 && !isValidImei(item.identity.imei1)) add(item, 'IMEI 1 inválido.');
    if (item.identity.imei2 && !isValidImei(item.identity.imei2)) add(item, 'IMEI 2 inválido.');

    const p = item.prices;
    if (p) {
      const { price_retail: a, price_reseller: b, price_wholesale: c } = p;
      if ((a != null && b != null && a < b) || (b != null && c != null && b < c) || (a != null && c != null && a < c)) {
        add(item, 'Preços fora da ordem: varejo ≥ revenda ≥ atacado.');
      }
    }

    for (const imei of [item.identity.imei1, item.identity.imei2]) {
      if (!imei) continue;
      const lines = seen.get(imei) || [];
      if (!lines.includes(item.line)) lines.push(item.line);
      seen.set(imei, lines);
    }
  }

  for (const [imei, lines] of seen) {
    if (lines.length < 2) continue;
    const sorted = [...lines].sort((x, y) => x - y);
    const label = sorted.length === 2 ? `${sorted[0]} e ${sorted[1]}` : `${sorted.slice(0, -1).join(', ')} e ${sorted[sorted.length - 1]}`;
    const message = `IMEI ${imei} repetido no lote (linhas ${label}).`;
    for (const item of out) if (sorted.includes(item.line)) add(item, message);
  }
  return out;
}

function planHash(plan) {
  const lines = plan.map(({ errors, ...rest }) => rest);
  return crypto.createHash('sha256').update(JSON.stringify(lines)).digest('hex');
}

module.exports = { SOURCES, isValidImei, cents, normalizeEntryItem, validateEntryBatch, planHash };
