'use strict';

// Conferência dos identificadores lidos pela IA contra os códigos de barras da etiqueta.
// Regra: o código de barras CONFERE, não sobrescreve. Divergência vira aviso para o
// usuário decidir na conferência (com sugestão do valor lido nas barras).

const { isValidImei, isValidGtin } = require('./smartphonePhotoIntakeCore.cjs');

const LINEAR_GTIN_FORMATS = new Set(['EAN13', 'EAN8', 'UPCA', 'UPCE', 'EAN-13', 'EAN-8', 'UPC-A', 'UPC-E']);

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeSerialText(value) {
  return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function digitDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) distance += 1;
  return distance;
}

// Separa o que as barras leram em IMEIs, GTINs (EAN) e textos livres (possível serial).
// Itens chegam em ordem de cima para baixo na etiqueta.
function classifyBarcodeItems(items = []) {
  const imeis = [];
  const eans = [];
  const texts = [];
  const push = (list, value) => { if (value && !list.includes(value)) list.push(value); };
  for (const item of Array.isArray(items) ? items : []) {
    const text = String(item?.text ?? '').trim();
    if (!text) continue;
    const format = String(item?.format ?? '');
    const digits = onlyDigits(text);
    if (LINEAR_GTIN_FORMATS.has(format)) {
      if (isValidGtin(digits)) push(eans, digits);
      continue;
    }
    // Code128 de IMEI costuma ter só os 15 dígitos; DataMatrix/QR podem trazer vários
    // números juntos, então procura toda sequência de 15 dígitos válida.
    for (const match of text.matchAll(/\d{15,}/g)) {
      const run = match[0];
      for (let start = 0; start + 15 <= run.length; start += 15) {
        const candidate = run.slice(start, start + 15);
        if (isValidImei(candidate)) push(imeis, candidate);
      }
    }
    if (/^\d+$/.test(text) && [8, 12, 13, 14].includes(text.length) && isValidGtin(text)) push(eans, text);
    if (text.length <= 64) push(texts, normalizeSerialText(text));
  }
  return { imeis, eans, texts };
}

function pickSuggestion(value, candidates) {
  if (!candidates.length) return null;
  if (!value) return candidates[0];
  return [...candidates].sort((a, b) => digitDistance(value, a) - digitDistance(value, b))[0];
}

const FIELD_LABEL = Object.freeze({ imei1: 'IMEI 1', imei2: 'IMEI 2', ean: 'EAN', serial: 'Serial' });

/**
 * @param {{imei1?:string|null, imei2?:string|null, ean?:string|null, serial?:string|null}} value
 * @param {{imeis:string[], eans:string[], texts:string[]}} barcode
 * @returns {{fields: Record<string, {status:string, barcode:string|null}>, warnings: Array<object>}}
 * status: confirmed (bate) | mismatch (barras leram outro) | barcode_only (IA não leu, barras sim) | unread (barras não leram)
 */
function crossCheckIdentifiers(value = {}, barcode = {}) {
  const imeis = Array.isArray(barcode.imeis) ? barcode.imeis : [];
  const eans = Array.isArray(barcode.eans) ? barcode.eans : [];
  const texts = Array.isArray(barcode.texts) ? barcode.texts : [];
  const fields = {};
  const warnings = [];
  const imei1 = onlyDigits(value.imei1);
  const imei2 = onlyDigits(value.imei2);

  const checkImei = (field, own, taken) => {
    if (!imeis.length) { fields[field] = { status: 'unread', barcode: null }; return; }
    if (own && imeis.includes(own)) { fields[field] = { status: 'confirmed', barcode: own }; return; }
    // Não sugere o IMEI que já pertence ao outro campo (barras vêm de cima para baixo).
    const free = imeis.filter((candidate) => candidate !== taken);
    const suggestion = pickSuggestion(own, free);
    if (!suggestion) { fields[field] = { status: 'unread', barcode: null }; return; }
    const status = own ? 'mismatch' : 'barcode_only';
    fields[field] = { status, barcode: suggestion };
    warnings.push({
      field,
      code: status === 'mismatch' ? 'barcode_mismatch' : 'barcode_only',
      message: status === 'mismatch'
        ? `${FIELD_LABEL[field]} diferente do código de barras (barras: ${suggestion})`
        : `${FIELD_LABEL[field]} lido só no código de barras: ${suggestion}`,
      barcode_value: suggestion,
    });
  };

  checkImei('imei1', imei1, imeis.includes(imei2) ? imei2 : '');
  checkImei('imei2', imei2, fields.imei1.barcode || '');

  const ean = onlyDigits(value.ean);
  if (!eans.length) fields.ean = { status: 'unread', barcode: null };
  else if (ean && eans.includes(ean)) fields.ean = { status: 'confirmed', barcode: ean };
  else {
    const suggestion = pickSuggestion(ean, eans);
    const status = ean ? 'mismatch' : 'barcode_only';
    fields.ean = { status, barcode: suggestion };
    warnings.push({
      field: 'ean',
      code: status === 'mismatch' ? 'barcode_mismatch' : 'barcode_only',
      message: status === 'mismatch' ? `EAN diferente do código de barras (barras: ${suggestion})` : `EAN lido só no código de barras: ${suggestion}`,
      barcode_value: suggestion,
    });
  }

  // Serial raramente tem barras próprias: só confirma quando aparece; nunca gera aviso.
  const serial = normalizeSerialText(value.serial);
  fields.serial = serial && texts.includes(serial)
    ? { status: 'confirmed', barcode: serial }
    : { status: 'unread', barcode: null };

  return { fields, warnings };
}

function isBarcodeIssue(issue = {}) {
  return ['barcode_mismatch', 'barcode_only'].includes(String(issue?.code || ''));
}

module.exports = { classifyBarcodeItems, crossCheckIdentifiers, isBarcodeIssue, digitDistance };
