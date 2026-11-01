// Consulta às tabelas oficiais guardadas em data/fiscal (geradas por scripts/fiscal-catalog-import.cjs).
// NCM: Siscomex. CEST: Convênio ICMS 142/2018. Somente leitura; nenhuma decisão tributária é tomada aqui.
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data', 'fiscal');
const DOOR_TO_DOOR_SEGMENT = '28'; // venda porta a porta: aplica-se a capítulos inteiros
let cache = null;

const digits = value => String(value ?? '').replace(/\D/g, '');
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const formatNcm = code => code.length === 8 ? `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}` : code;
const formatCest = code => code.length === 7 ? `${code.slice(0, 2)}.${code.slice(2, 5)}.${code.slice(5)}` : code;

function load(dir = DATA_DIR) {
  if (cache && cache.dir === dir) return cache;
  const ncm = JSON.parse(fs.readFileSync(path.join(dir, 'ncm-vigente.json'), 'utf8'));
  const cest = JSON.parse(fs.readFileSync(path.join(dir, 'cest-conv142.json'), 'utf8'));
  const ncmByCode = new Map(ncm.items.map(([code, description, start, end]) => [code, { code, description, start, end }]));
  const cestItems = cest.items.map(([code, segment, prefixes, description]) => ({ code, segment, prefixes, description }));
  cache = { dir, ncm, cest, ncmByCode, cestItems, cestByCode: new Map(cestItems.map(item => [item.code, item])),
    ncmSearch: ncm.items.map(([code, description]) => [code, fold(description)]) };
  return cache;
}

function info(dir) {
  const { ncm, cest } = load(dir);
  return { ncm: { source: ncm.source, vigencia: ncm.vigencia, ato: ncm.ato, count: ncm.count, generatedAt: ncm.generatedAt },
    cest: { source: cest.source, count: cest.count, note: cest.note, generatedAt: cest.generatedAt } };
}

function ncmView(entry, catalog) {
  return { code: entry.code, formatted: formatNcm(entry.code), description: entry.description,
    heading: catalog.ncm.headings?.[entry.code.slice(0, 4)] || '', validFrom: entry.start, validUntil: entry.end };
}

/** Valida um NCM digitado. Retorna a descrição oficial ou o motivo da recusa. */
function lookupNcm(value, dir) {
  const catalog = load(dir);
  const code = digits(value);
  if (!code) return { valid: false, code, issue: 'ncm_missing', message: 'Informe o NCM.' };
  if (code.length !== 8) return { valid: false, code, issue: 'ncm_incomplete', message: `NCM tem 8 dígitos; foram informados ${code.length}.` };
  const entry = catalog.ncmByCode.get(code);
  if (!entry) return { valid: false, code, formatted: formatNcm(code), issue: 'ncm_not_found', message: 'NCM não existe na tabela vigente.' };
  return { valid: true, ...ncmView(entry, catalog) };
}

function searchNcm(query, { limit = 20, dir } = {}) {
  const catalog = load(dir);
  const max = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const code = digits(query);
  const text = fold(query).trim();
  const out = [];
  if (code.length >= 2 && code.length === String(query).replace(/[\s.]/g, '').length) {
    for (const [ncm] of catalog.ncmSearch) { if (ncm.startsWith(code)) out.push(ncm); if (out.length >= max) break; }
  } else if (text.length >= 3) {
    const words = text.split(/\s+/).filter(Boolean);
    for (const [ncm, description] of catalog.ncmSearch) { if (words.every(word => description.includes(word))) out.push(ncm); if (out.length >= max) break; }
  }
  return out.map(ncm => ncmView(catalog.ncmByCode.get(ncm), catalog));
}

/** CESTs do Convênio 142/2018 cujo NCM/prefixo cobre o NCM informado; o mais específico primeiro. */
function cestForNcm(value, { includeDoorToDoor = false, dir } = {}) {
  const catalog = load(dir);
  const code = digits(value);
  if (code.length !== 8) return [];
  const matches = [];
  for (const item of catalog.cestItems) {
    if (!includeDoorToDoor && item.segment === DOOR_TO_DOOR_SEGMENT) continue;
    const prefix = item.prefixes.filter(p => code.startsWith(p)).sort((a, b) => b.length - a.length)[0];
    if (prefix) matches.push({ code: item.code, formatted: formatCest(item.code), segment: item.segment, description: item.description,
      matchedPrefix: prefix, doorToDoor: item.segment === DOOR_TO_DOOR_SEGMENT });
  }
  return matches.sort((a, b) => b.matchedPrefix.length - a.matchedPrefix.length || a.code.localeCompare(b.code));
}

function lookupCest(value, dir) {
  const catalog = load(dir);
  const code = digits(value);
  const item = catalog.cestByCode.get(code);
  if (!item) return null;
  return { code: item.code, formatted: formatCest(item.code), segment: item.segment, description: item.description, prefixes: item.prefixes };
}

function cestMatchesNcm(cest, ncm, dir) {
  const item = lookupCest(cest, dir);
  const code = digits(ncm);
  return !!item && code.length === 8 && item.prefixes.some(prefix => code.startsWith(prefix));
}

module.exports = { info, lookupNcm, searchNcm, cestForNcm, lookupCest, cestMatchesNcm, formatNcm, formatCest, DOOR_TO_DOOR_SEGMENT };
