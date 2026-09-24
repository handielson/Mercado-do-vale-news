const { randomInt } = require('node:crypto');

function checkDigit(base) {
  if (!/^\d{43}$/.test(base)) throw new Error('Base da chave fiscal inválida.');
  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index--) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const digit = 11 - sum % 11;
  return digit > 9 ? 0 : digit;
}

// Constrói somente a identidade modelo 65; não gera XML nem autoriza documento.
function makeNfceAccessKey({ ufCode, issuedAt, cnpj, series, number, emissionType = 1, numericCode }) {
  const timestamp = String(issuedAt || '');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error('Data de emissão inválida.');
  const yearMonth = timestamp.slice(2, 4) + timestamp.slice(5, 7);
  if (!/^\d{2}$/.test(String(ufCode)) || !/^\d{14}$/.test(String(cnpj))
    || !Number.isSafeInteger(series) || series < 0 || series > 999
    || !Number.isSafeInteger(number) || number < 1 || number > 999999999
    || ![1, 9].includes(emissionType)) throw new Error('Identidade da NFC-e inválida.');
  const code = numericCode === undefined ? randomInt(0, 100000000) : numericCode;
  if (!Number.isSafeInteger(code) || code < 0 || code > 99999999) throw new Error('Código numérico da NFC-e inválido.');
  const base = `${ufCode}${yearMonth}${cnpj}65${String(series).padStart(3, '0')}${String(number).padStart(9, '0')}${emissionType}${String(code).padStart(8, '0')}`;
  return { key: base + checkDigit(base), numericCode: String(code).padStart(8, '0'), checkDigit: checkDigit(base) };
}

module.exports = { checkDigit, makeNfceAccessKey };
