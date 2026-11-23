#!/usr/bin/env node
// product-measures-single-source-v1: alinha colunas (weight_kg/dimensions) e Especificações.
// Regra: especificação vence; sem especificação vale a coluna; sem as duas, o modelo.
// Kits do Suporte Flange ficam com a altura somada (coluna vence).
// Uso no VPS (pasta /var/www/mdv-api): node backfill-product-measures.cjs [--apply]
require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');
const APPLY = process.argv.includes('--apply');
const COLUMN_WINS = new Set(['SFKU3XK2B', 'SFKU3XK2P', 'SFKU3XK5B', 'SFKU3XK5P']);
const KEYS = ['height_cm', 'width_cm', 'depth_cm'];
const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const obj = (v) => { if (!v) return {}; if (typeof v === 'string') { try { return obj(JSON.parse(v)); } catch { return {}; } } return typeof v === 'object' ? v : {}; };
const spec = (s, k) => k === 'weight_kg' ? num(s.weight_kg) : (num(s[`dimensions.${k}`]) ?? num(obj(s.dimensions)[k]));
const col = (w, d, k) => k === 'weight_kg' ? num(w) : num(obj(d)[k]);
const same = (a, b) => (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);
(async () => {
  const pool = await mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  const [rows] = await pool.query(`SELECT p.id, p.sku, p.name, p.status, p.weight_kg, p.dimensions, p.specs, m.template_values FROM products p LEFT JOIN models m ON m.id = p.model_id`);
  const changes = [];
  for (const r of rows) {
    const s = obj(r.specs), t = obj(r.template_values);
    const out = {};
    // 20x14x7 foi preenchido em massa: o lado com esse padrão perde para o outro lado com medida real.
    const isDefault = (get) => get('height_cm') === 20 && get('width_cm') === 14 && get('depth_cm') === 7;
    const hasDims = (get) => KEYS.every((k) => get(k) !== null);
    const sGet = (k) => spec(s, k), cGet = (k) => col(r.weight_kg, r.dimensions, k);
    const columnFirst = COLUMN_WINS.has(r.sku) || (isDefault(sGet) && hasDims(cGet) && !isDefault(cGet));
    for (const k of ['weight_kg', ...KEYS]) {
      const sv = sGet(k), cv = cGet(k), tv = spec(t, k);
      out[k] = columnFirst ? (cv ?? sv ?? tv) : (sv ?? cv ?? tv);
    }
    const colChanged = ['weight_kg', ...KEYS].some((k) => !same(out[k], col(r.weight_kg, r.dimensions, k)));
    const specChanged = ['weight_kg', ...KEYS].some((k) => !same(out[k], spec(s, k)));
    if (!colChanged && !specChanged) continue;
    const before = `${col(r.weight_kg, r.dimensions, 'weight_kg')}kg ${KEYS.map((k) => col(r.weight_kg, r.dimensions, k)).join('x')}`;
    const after = `${out.weight_kg}kg ${KEYS.map((k) => out[k]).join('x')}`;
    changes.push({ r, s, out, colChanged, specChanged, before, after });
  }
  const colCount = changes.filter((c) => c.colChanged).length;
  const specOnly = changes.filter((c) => !c.colChanged).length;
  console.log(`produtos: ${rows.length} | mudam as medidas usadas no frete: ${colCount} | só completam as Especificações: ${specOnly}`);
  const csv = ['sku;nome;status;antes (frete);depois'].concat(changes.filter((c) => c.colChanged).map((c) => [c.r.sku, String(c.r.name).replace(/;/g, ','), c.r.status, c.before, c.after].join(';')));
  fs.writeFileSync('/tmp/medidas-preview.csv', csv.join('\n'));
  console.log('preview: /tmp/medidas-preview.csv');
  if (!APPLY) { await pool.end(); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync('backups', { recursive: true });
  fs.writeFileSync(`backups/product-measures-${stamp}.json`, JSON.stringify(changes.map((c) => ({ id: c.r.id, sku: c.r.sku, weight_kg: c.r.weight_kg, dimensions: c.r.dimensions, specs: c.r.specs }))));
  let n = 0;
  for (const c of changes) {
    const dims = KEYS.some((k) => c.out[k] !== null) ? { ...obj(c.r.dimensions), ...Object.fromEntries(KEYS.map((k) => [k, c.out[k]])) } : null;
    const specs = { ...c.s };
    if (c.out.weight_kg !== null) specs.weight_kg = c.out.weight_kg;
    for (const k of KEYS) if (c.out[k] !== null) specs[`dimensions.${k}`] = c.out[k];
    await pool.query('UPDATE products SET weight_kg = ?, dimensions = ?, specs = ? WHERE id = ?', [c.out.weight_kg, dims ? JSON.stringify(dims) : null, JSON.stringify(specs), c.r.id]);
    n++;
  }
  console.log(`aplicado em ${n} produtos; backup em backups/product-measures-${stamp}.json`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
