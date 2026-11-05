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

export function emptyState() {
  return { lines: [], plan: null, hash: null, previewedSignature: null };
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
    storage.setItem(DRAFT_KEY, JSON.stringify({ lines: state.lines }));
  } catch { /* rascunho é conveniência */ }
}

export function loadDraft(storage) {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lines)) return emptyState();
    const lines = parsed.lines.filter(l => l && typeof l.key === 'string' && l.item && typeof l.item === 'object');
    return { ...emptyState(), lines };
  } catch {
    return emptyState();
  }
}
