// Regra da Lista de entrada (JS puro, sem React): linhas, prévia, confirmação e rascunho.

export const DRAFT_KEY = 'mdv-entrada-rascunho-v1';

let counter = 0;
function newKey() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* cai no contador */ }
  counter += 1;
  return `line-${Date.now().toString(36)}-${counter}`;
}

/** Chave de idempotência do envio (uuid v4). Fica com a lista até uma confirmação dar certo. */
export function newBatchId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* cai no gerador abaixo */ }
  const bytes = new Uint8Array(16);
  try { crypto.getRandomValues(bytes); } catch { for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256); }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const BATCH_ID = /^[A-Za-z0-9-]{8,36}$/;

export function emptyState() {
  return { lines: [], plan: null, hash: null, previewedSignature: null, clientBatchId: newBatchId() };
}

function last4(value) {
  const s = String(value || '').trim();
  return s.length > 4 ? s.slice(-4) : s;
}

function buildLabel(item) {
  const cfg = item.configuration || {};
  const id = item.identity || {};
  const parts = [item.name || 'Item'];
  if (cfg.ram || cfg.storage) parts.push([cfg.ram, cfg.storage].filter(Boolean).join('/'));
  if (item.color) parts.push(item.color);
  if (id.imei1) parts.push(`IMEI …${last4(id.imei1)}`);
  else if (id.serial) parts.push(`Serial …${last4(id.serial)}`);
  else if (Number(item.quantity) > 1) parts.push(`${item.quantity} un.`);
  return parts.join(' · ');
}

export function createLine(fields, { source } = {}) {
  const item = { ...(fields || {}), source: source || fields?.source || 'manual' };
  return { key: newKey(), source: item.source, item, label: buildLabel(item) };
}

export function addLines(state, lines) {
  return { ...state, lines: [...state.lines, ...(lines || [])] };
}

export function updateLine(state, key, item) {
  return {
    ...state,
    lines: state.lines.map(line => {
      if (line.key !== key) return line;
      const next = { ...item, source: item.source || line.source };
      return { ...line, item: next, label: buildLabel(next) };
    }),
  };
}

export function removeLine(state, key) {
  return { ...state, lines: state.lines.filter(line => line.key !== key) };
}

export function toItems(state) {
  return state.lines.map(line => line.item);
}

function signature(state) {
  return JSON.stringify(toItems(state));
}

export function applyPreview(state, result) {
  return {
    ...state,
    plan: Array.isArray(result?.plan) ? result.plan : [],
    hash: result?.ok ? (result.hash ?? null) : null,
    previewedSignature: signature(state),
    previewOk: Boolean(result?.ok),
  };
}

function isFresh(state) {
  return state.plan != null && state.previewedSignature === signature(state);
}

export function canConfirm(state) {
  return Boolean(
    state.lines.length > 0
    && isFresh(state)
    && state.previewOk
    && state.hash
    && state.plan.every(p => !p?.errors?.length),
  );
}

export function lineStatus(state, key) {
  const index = state.lines.findIndex(line => line.key === key);
  const planLine = index >= 0 && isFresh(state) ? state.plan[index] : null;
  if (!planLine) return { state: 'pending', badges: [], errors: [] };
  const errors = Array.isArray(planLine.errors) ? [...planLine.errors] : [];
  const badges = [];
  if (planLine.family === 'new') badges.push('família nova');
  else if (planLine.variation === 'new') badges.push('cor nova');
  else if (planLine.variation === 'existing') badges.push('já existe');
  if (planLine.price_source === 'group-new') badges.push('preço da configuração novo');
  return { state: errors.length ? 'error' : 'ok', badges, errors };
}

export function hasIdentity(state, imeiOrSerial) {
  const wanted = String(imeiOrSerial ?? '').trim().toLowerCase();
  if (!wanted) return false;
  return state.lines.some(line => {
    const id = line.item?.identity || {};
    return [id.imei1, id.imei2, id.serial]
      .some(v => v && String(v).trim().toLowerCase() === wanted);
  });
}

export function saveDraft(state, storage) {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify({ lines: state.lines, clientBatchId: state.clientBatchId }));
  } catch { /* rascunho é conveniência */ }
}

export function loadDraft(storage) {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lines)) return emptyState();
    const lines = parsed.lines.filter(l => l && typeof l.key === 'string' && l.item && typeof l.item === 'object');
    const clientBatchId = typeof parsed.clientBatchId === 'string' && BATCH_ID.test(parsed.clientBatchId) ? parsed.clientBatchId : newBatchId();
    return { ...emptyState(), lines, clientBatchId };
  } catch {
    return emptyState();
  }
}

/** 15 dígitos + Luhn (mesma regra de services/catalogEntryCore.cjs; o servidor valida de novo). */
export function isValidImei(value) {
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

const VPS_ERROR = /^\[VPS\] (\d{3})\b/;

function vpsBody(message) {
  const at = message.indexOf(' — ');
  return at >= 0 ? message.slice(at + 3) : '';
}

/** Campo `error` (ou `code`) do JSON do servidor dentro da mensagem do vpsClient; tolera corpo truncado. */
function bodyField(message, field) {
  const body = vpsBody(message);
  if (!body.startsWith('{')) return null;
  try {
    const value = JSON.parse(body)?.[field];
    return typeof value === 'string' && value ? value : null;
  } catch {
    const m = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(body);
    if (!m) return null;
    try { return JSON.parse(`"${m[1]}"`) || null; } catch { return m[1] || null; }
  }
}

/** Texto para o operador: só a mensagem do servidor quando ela existe. */
export function errorText(err) {
  if (!(err instanceof Error)) return 'erro desconhecido';
  return bodyField(err.message, 'error') || err.message || 'erro desconhecido';
}

/**
 * Como tratar a falha da confirmação. 400/409/422 são recusas do servidor (nada gravado);
 * qualquer outra coisa (timeout, rede, 5xx) é ambígua: a gravação pode ter acontecido.
 */
export function commitErrorKind(err) {
  const message = err instanceof Error ? err.message : '';
  const status = VPS_ERROR.exec(message)?.[1];
  if (status === '409') return bodyField(message, 'code') === 'client_batch_conflict' ? 'client-batch-conflict' : 'conflict';
  if (status === '422') return 'invalid';
  if (status === '400') return 'rejected';
  return 'ambiguous';
}
