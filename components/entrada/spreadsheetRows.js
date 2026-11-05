// Conversão da planilha da Entrada em linhas da Lista de entrada (JS puro, sem React).
import { createLine, isValidImei } from './entryList.js';

export const ENTRY_TEMPLATE_HEADERS = [
  'Modelo', 'Categoria', 'Nome', 'RAM', 'Armazenamento', 'Versão', 'Condição', 'Observação',
  'Cor', 'IMEI 1', 'IMEI 2', 'Serial', 'Quantidade', 'Custo', 'Local', 'Varejo', 'Revenda', 'Atacado',
];

export const MAX_ROWS = 500;
const IMEI_UNREADABLE = 'IMEI ilegível (formate a coluna como texto)';

export function templateExampleRows() {
  const blank = Object.fromEntries(ENTRY_TEMPLATE_HEADERS.map(h => [h, '']));
  return [
    {
      ...blank, Modelo: 'Redmi 15', RAM: '8GB', Armazenamento: '256GB', 'Versão': 'Global',
      'Condição': 'Seminovo', 'Observação': 'Pequeno arranhão na tampa', Cor: 'Preto',
      'IMEI 1': '863715061138763', Custo: '800,00', Varejo: '1.299,00', Revenda: '1.100,00', Atacado: '1.000,00',
    },
    {
      ...blank, Categoria: 'Acessórios', Nome: 'Cabo USB-C 1m', 'Condição': 'Novo', Quantidade: 10, Custo: '8,50',
    },
  ];
}

/** Minúsculas, sem acento e só letras/dígitos: "Imei-1" e "IMEI 1" viram "imei1". */
function norm(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Para nomes: como norm, mas mantém a separação por espaço única. */
function normName(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Dinheiro em centavos; `undefined` se vazio; `null` se inválido. */
export function parseMoney(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  }
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (!s) return undefined;
  if (s.includes(',')) {
    if (!/^(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const cents = Math.round(Number(`0.${m[2] || '0'}`) * 100);
  return Number(m[1]) * 100 + cents;
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  return String(value).trim();
}

function isBlank(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ||
    (value instanceof Date && Number.isNaN(value.getTime()));
}

// Mesmas listas da ManualEntryTab (RAM_OPTIONS / STORAGE_OPTIONS).
const RAM_OPTIONS = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB', '18GB', '24GB'];
const STORAGE_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const OLD_TEMPLATE_HEADERS = ['acao', 'modelonome', 'categorianome', 'precovarejo'];

/** '' se vazio; texto normalizado ("8gb" -> "8GB"); `{ error }` se fora da lista. */
function readSize(value, options, label, bareTb) {
  if (isBlank(value)) return '';
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  const m = value instanceof Date ? null : /^(\d+)\s*(gb|tb)?$/i.exec(raw);
  if (m) {
    const unit = m[2] ? m[2].toUpperCase() : (bareTb && ['1', '2'].includes(m[1]) ? 'TB' : 'GB');
    const out = `${Number(m[1])}${unit}`;
    if (options.includes(out)) return out;
  }
  return { error: `${label} inválida: ${raw}`.replace('Armazenamento inválida', 'Armazenamento inválido') };
}

const CONDITIONS = { novo: 'new', new: 'new', seminovo: 'seminovo', usado: 'used', used: 'used', caixaaberta: 'open_box', openbox: 'open_box' };

/** Texto do IMEI ou `{ error }`; '' quando vazio. */
function readImei(value) {
  if (isBlank(value)) return '';
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value >= 0) return String(Math.trunc(value));
    return { error: IMEI_UNREADABLE };
  }
  const s = String(value).trim();
  if (/e\+/i.test(s)) return { error: IMEI_UNREADABLE };
  return s;
}

function readQuantity(value) {
  if (isBlank(value)) return 1;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function joinRows(rows) {
  if (rows.length <= 2) return rows.join(' e ');
  return `${rows.slice(0, -1).join(', ')} e ${rows[rows.length - 1]}`;
}

export function rowsToLines(records, ctx) {
  const list = Array.isArray(records) ? records : [];
  const { models = [], categories = [], locations = [] } = ctx || {};

  const headerKeys = new Set();
  for (const rec of list) for (const key of Object.keys(rec || {})) headerKeys.add(norm(key));
  if (OLD_TEMPLATE_HEADERS.some(h => headerKeys.has(h))
    || (list.length > 0 && !headerKeys.has('modelo') && !headerKeys.has('nome'))) {
    return { lines: [], issues: [], fatal: 'Esta planilha não é o modelo da Entrada. Baixe o modelo.' };
  }
  if (list.length > MAX_ROWS) {
    return { lines: [], issues: [], fatal: `Planilha acima de ${MAX_ROWS} linhas.` };
  }

  const defaultLocation = locations.find(l => l.is_default) || null;
  const issues = [];
  const parsed = []; // { row, problems:number, item }
  const imeiRows = new Map(); // imei -> [row]

  list.forEach((rec, index) => {
    const row = index + 2;
    const cell = {};
    for (const [key, value] of Object.entries(rec || {})) { const k = norm(key); if (!(k in cell) || isBlank(cell[k])) cell[k] = value; }
    const get = name => cell[name];
    if (Object.values(cell).every(isBlank)) return;

    const problems = [];
    const problem = message => problems.push(message);

    // Modelo ou categoria + nome.
    let model = null;
    let category = null;
    let name = text(get('nome'));
    const modelText = text(get('modelo'));
    if (modelText) {
      const byId = models.find(m => String(m.id) === modelText);
      if (byId) model = byId;
      else {
        const matches = models.filter(m => normName(m.name) === normName(modelText));
        if (matches.length > 1) problem(`Modelo "${matches[0].name}" encontrado mais de uma vez; use o ID do modelo.`);
        else if (matches.length === 1) model = matches[0];
        else problem(`Modelo "${modelText}" não encontrado.`);
      }
    } else {
      const categoryText = text(get('categoria'));
      if (!categoryText || !name) problem('Informe o modelo ou a categoria e o nome.');
      else {
        category = categories.find(c => normName(c.name) === normName(categoryText)) || null;
        if (!category) problem(`Categoria "${categoryText}" não encontrada.`);
      }
    }

    // Condição.
    const conditionText = text(get('condicao'));
    let condition = 'new';
    if (conditionText) {
      condition = CONDITIONS[norm(conditionText)];
      if (!condition) { problem(`Condição inválida: ${conditionText}`); condition = 'new'; }
    }

    // Local.
    let locationId = '';
    const locationText = text(get('local'));
    if (locationText) {
      const wanted = normName(locationText);
      const loc = locations.find(l => String(l.id) === locationText)
        || locations.find(l => normName(l.code) === wanted || normName(l.name) === wanted);
      if (loc) locationId = loc.id;
      else problem(`Local "${locationText}" não encontrado.`);
    } else if (defaultLocation) locationId = defaultLocation.id;
    else problem('Escolha o local de estoque.');

    // Identidade.
    const identity = { imei1: null, imei2: null, serial: text(get('serial')) || null };
    [['imei1', 'IMEI 1'], ['imei2', 'IMEI 2']].forEach(([key, label]) => {
      const read = readImei(get(key));
      if (read === '') return;
      if (typeof read === 'object') { problem(read.error); return; }
      if (!isValidImei(read)) { problem(`${label} inválido.`); return; }
      identity[key] = read;
    });
    if (identity.imei1 && identity.imei1 === identity.imei2) problem('IMEI 1 e IMEI 2 não podem ser iguais.');
    for (const imei of new Set([identity.imei1, identity.imei2].filter(Boolean))) {
      imeiRows.set(imei, [...(imeiRows.get(imei) || []), row]);
    }

    // Quantidade.
    let quantity = 1;
    if (identity.imei1 || identity.imei2 || identity.serial) quantity = 1;
    else {
      const q = readQuantity(get('quantidade'));
      if (q === null) problem('Quantidade inválida.');
      else quantity = q;
    }

    // Dinheiro.
    const cost = parseMoney(get('custo'));
    if (cost === null) problem('Custo inválido.');
    const priceCells = [['varejo', 'Varejo'], ['revenda', 'Revenda'], ['atacado', 'Atacado']]
      .map(([key, label]) => ({ label, value: parseMoney(get(key)) }));
    let prices = null;
    const bad = priceCells.filter(p => p.value === null);
    const filled = priceCells.filter(p => p.value !== undefined);
    bad.forEach(p => problem(`${p.label} inválido.`));
    if (!bad.length && filled.length > 0) {
      if (filled.length < 3) problem('Informe varejo, revenda e atacado juntos.');
      else prices = { price_retail: priceCells[0].value, price_reseller: priceCells[1].value, price_wholesale: priceCells[2].value };
    }

    const note = text(get('observacao'));
    const sizes = [readSize(get('ram'), RAM_OPTIONS, 'RAM', false), readSize(get('armazenamento'), STORAGE_OPTIONS, 'Armazenamento', true)];
    sizes.forEach(v => { if (typeof v === 'object') problem(v.error); });
    const [ram, storage] = sizes.map(v => (typeof v === 'object' ? '' : v));
    const item = {
      source: 'planilha',
      ...(model
        ? { model_id: model.id, category_id: model.category_id ?? null, name: model.name }
        : { category_id: category?.id ?? null, name }),
      configuration: {
        ram,
        storage,
        version: text(get('versao')) || 'Global',
        network: '',
        condition,
      },
      color: text(get('cor')),
      condition_note: condition === 'seminovo' && note ? note : null,
      identity,
      quantity,
      cost_cents: cost ?? 0,
      location_id: locationId,
      prices,
    };

    problems.forEach(message => issues.push({ row, message }));
    parsed.push({ row, ok: problems.length === 0, item });
  });

  // IMEI repetido: avisa todas as linhas envolvidas.
  const duplicated = new Set();
  for (const rows of imeiRows.values()) {
    if (rows.length < 2) continue;
    const message = `IMEI repetido no arquivo (linhas ${joinRows(rows)})`;
    for (const row of rows) {
      if (!duplicated.has(row + message)) { issues.push({ row, message }); duplicated.add(row + message); }
      const p = parsed.find(x => x.row === row);
      if (p) p.ok = false;
    }
  }
  issues.sort((a, b) => a.row - b.row);

  const lines = parsed.filter(p => p.ok).map(p => createLine(p.item, { source: 'planilha' }));
  return { lines, issues };
}
