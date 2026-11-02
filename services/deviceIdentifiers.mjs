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
