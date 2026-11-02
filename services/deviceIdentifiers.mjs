// Validação de identificadores de aparelho usada nas telas (mesma regra do servidor em
// services/smartphonePhotoIntakeCore.cjs): IMEI com 15 dígitos e dígito de Luhn; EAN/GTIN com 8, 12, 13 ou 14 dígitos.

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isValidLuhn(value) {
  const digits = onlyDigits(value);
  if (!digits) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function isValidImei(value) {
  const digits = onlyDigits(value);
  return digits.length === 15 && /^\d{15}$/.test(String(value ?? '').trim()) && isValidLuhn(digits);
}

export function isValidGtin(value) {
  const digits = String(value ?? '').trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) return false;
  let sum = 0;
  for (let index = digits.length - 2, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) sum += Number(digits[index]) * weight;
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Situação de um campo para mostrar ao usuário enquanto digita ou bipa. */
export function describeIdentifier(kind, value) {
  const text = String(value ?? '').trim();
  if (!text) return { state: 'empty', message: '' };
  if (kind === 'imei') {
    if (/\D/.test(text)) return { state: 'invalid', message: 'IMEI tem só números' };
    if (text.length < 15) return { state: 'incomplete', message: `Faltam ${15 - text.length} dígito(s)` };
    if (text.length > 15) return { state: 'invalid', message: 'IMEI tem 15 dígitos' };
    return isValidLuhn(text) ? { state: 'ok', message: 'IMEI válido' } : { state: 'invalid', message: 'IMEI inválido: confira os dígitos' };
  }
  if (kind === 'ean') {
    if (/\D/.test(text)) return { state: 'invalid', message: 'Código de barras tem só números' };
    if (![8, 12, 13, 14].includes(text.length)) return { state: text.length < 13 ? 'incomplete' : 'invalid', message: 'EAN tem 8, 12, 13 ou 14 dígitos' };
    return isValidGtin(text) ? { state: 'ok', message: 'Código válido' } : { state: 'invalid', message: 'Código inválido: confira os dígitos' };
  }
  if (kind === 'serial') {
    if (text.length < 6) return { state: 'incomplete', message: 'Serial curto: confira' };
    return { state: 'ok', message: '' };
  }
  return { state: 'ok', message: '' };
}

/** Atributos de teclado por tipo de campo (abre o teclado certo no celular). */
export function identifierInputProps(kind) {
  const base = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false };
  if (kind === 'imei' || kind === 'ean') return { ...base, inputMode: 'numeric', pattern: '[0-9]*', autoCapitalize: 'off' };
  if (kind === 'serial') return { ...base, inputMode: 'text', autoCapitalize: 'characters' };
  return { ...base, inputMode: 'text', autoCapitalize: 'sentences' };
}

/**
 * Compara o que está no campo com o que o código de barras da etiqueta leu.
 * @param {{status?: string, barcode?: string|null}|null|undefined} barcodeField resultado salvo pela API
 * @param {string} value valor atual do campo
 * @returns {{ state: 'match' | 'differs', value: string } | null} null quando as barras não leram este campo
 */
export function barcodeHint(barcodeField, value) {
  const barcode = String(barcodeField?.barcode ?? '').trim();
  if (!barcode) return null;
  const normalize = (text) => String(text ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return normalize(value) === normalize(barcode) ? { state: 'match', value: barcode } : { state: 'differs', value: barcode };
}

/** Link para achar a unidade já cadastrada pelo IMEI/serial que bateu. */
export function registeredUnitLink(issue) {
  if (!issue || issue.code !== 'already_registered') return null;
  const search = String(issue.matched_value ?? '').trim();
  return search ? `/admin/serializados?search=${encodeURIComponent(search)}` : null;
}

/**
 * Filtra o que a câmera leu para o tipo de campo.
 * imei: toda sequência de 15 dígitos válida (Luhn) — DataMatrix pode trazer várias;
 * ean: GTIN válido; serial: texto lido que não é IMEI nem EAN.
 * @param {'imei' | 'ean' | 'serial'} kind
 * @param {Array<{ text: string, y?: number }>} reads leituras (y = posição vertical, para ordenar de cima para baixo)
 * @returns {string[]} valores únicos, na ordem da etiqueta
 */
export function pickScannedValues(kind, reads) {
  const ordered = [...(Array.isArray(reads) ? reads : [])]
    .filter(read => read && String(read.text ?? '').trim())
    .sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));
  const out = [];
  const push = value => { if (value && !out.includes(value)) out.push(value); };
  for (const read of ordered) {
    const text = String(read.text).trim();
    const digits = onlyDigits(text);
    if (kind === 'imei') {
      for (const match of text.matchAll(/\d{15,}/g)) {
        for (let start = 0; start + 15 <= match[0].length; start += 15) {
          const candidate = match[0].slice(start, start + 15);
          if (isValidImei(candidate)) push(candidate);
        }
      }
    } else if (kind === 'ean') {
      if (/^\d+$/.test(text) && isValidGtin(digits)) push(digits);
    } else if (kind === 'serial') {
      const isImei = /^\d{15}$/.test(text) && isValidImei(text);
      const isEan = /^\d+$/.test(text) && isValidGtin(text);
      const clean = text.replace(/\s+/g, '').toUpperCase();
      // Só números com 15 dígitos (IMEI lido errado) ou curtos (sufixos de DataMatrix) não são serial.
      const digitsOnlyNoise = /^\d+$/.test(clean) && (clean.length === 15 || clean.length <= 8);
      if (!isImei && !isEan && !digitsOnlyNoise && clean.length >= 8 && clean.length <= 40 && /^[0-9A-Z/\-_.]+$/.test(clean)) push(clean);
    }
  }
  return out;
}

const UNIT_STATUS_LABEL = Object.freeze({
  available: 'disponível',
  reserved: 'reservado',
  sold: 'vendido',
  scrapped: 'descartado',
  rma: 'em RMA',
  hidden: 'oculto',
});

/**
 * Aviso curto de aparelho já cadastrado: "Já cadastrado em 05/08/2026 — vendido (Realme C71)".
 * @param {{ status?: string, created_at?: string | Date, product_name?: string }} unit
 */
export function describeRegisteredUnitShort(unit) {
  const raw = unit?.created_at;
  const date = raw ? (raw instanceof Date ? raw : new Date(String(raw).replace(' ', 'T'))) : null;
  const when = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Recife' }).format(date)
    : '';
  const status = UNIT_STATUS_LABEL[String(unit?.status || '')] || String(unit?.status || '').trim();
  const product = String(unit?.product_name || '').trim();
  return `Já cadastrado${when ? ` em ${when}` : ''}${status ? ` — ${status}` : ''}${product ? ` (${product})` : ''}`;
}

/** Quando vale consultar o cadastro: IMEI completo (15 dígitos) ou serial com tamanho de serial. */
export function shouldLookupIdentifier(kind, value) {
  const text = String(value ?? '').trim();
  if (kind === 'imei') return /^\d{15}$/.test(text);
  if (kind === 'serial') return text.replace(/\s+/g, '').length >= 6;
  return false;
}
