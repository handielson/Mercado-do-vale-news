'use strict';
// stock-locations-reconcile-v1: locais de estoque divergentes do total → acerta pelo saldo do Bling (fonte da verdade).
// Roda no servidor (cwd /var/www/mdv-api). Sem --apply só mostra o que mudaria. Faz backup antes de aplicar.
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const APPLY = process.argv.includes('--apply');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  const [rows] = await db.query(`SELECT p.id, p.sku, p.bling_id, p.stock_quantity,
      (SELECT COALESCE(SUM(quantity),0) FROM product_stock_locations l WHERE l.product_id=p.id) loc,
      (SELECT COALESCE(SUM(reserved_quantity),0) FROM product_stock_locations l WHERE l.product_id=p.id) res
    FROM products p
    WHERE EXISTS (SELECT 1 FROM product_stock_locations l WHERE l.product_id=p.id)
      AND p.stock_quantity <> (SELECT COALESCE(SUM(quantity),0) FROM product_stock_locations l WHERE l.product_id=p.id)
      AND NOT EXISTS (SELECT 1 FROM units u WHERE u.product_id=p.id)`);
  const [[cfg]] = await db.query('SELECT bling_access_token t FROM company_settings LIMIT 1');
  const withBling = rows.filter((r) => r.bling_id);
  const bling = new Map();
  for (let i = 0; i < withBling.length; i += 50) {
    const chunk = withBling.slice(i, i + 50);
    const qs = chunk.map((r) => `idsProdutos[]=${encodeURIComponent(r.bling_id)}`).join('&');
    const res = await fetch(`https://api.bling.com.br/Api/v3/estoques/saldos?${qs}`, { headers: { Authorization: `Bearer ${cfg.t}` } });
    if (!res.ok) throw new Error(`Bling ${res.status}`);
    for (const it of (await res.json()).data || []) bling.set(String(it.produto?.id), Number(it.saldoFisicoTotal));
    await sleep(450);
  }
  const plan = rows.map((r) => ({ ...r, bling: r.bling_id ? bling.get(String(r.bling_id)) : undefined }));
  // Só acerta os locais quando o total do MdV já bate com o Bling; o resto (Bling negativo, SKU duplicado) vai para revisão.
  const all = plan.filter((r) => Number.isFinite(r.bling));
  const ok = all.filter((r) => r.bling === Number(r.stock_quantity) && r.bling >= Number(r.res));
  const skip = plan.filter((r) => !Number.isFinite(r.bling));
  const totalChanges = all.filter((r) => r.bling !== Number(r.stock_quantity));
  const belowReserved = all.filter((r) => r.bling < Number(r.res));
  console.log(JSON.stringify({ divergentes: rows.length, aplicaveis: ok.length, semBling: skip.map((r) => r.sku),
    totalMuda: totalChanges.length, abaixoDaReserva: belowReserved.map((r) => r.sku) }));
  for (const r of totalChanges.slice(0, 40)) console.log(`  ${r.sku}: MdV ${r.stock_quantity} / locais ${r.loc} → Bling ${r.bling}`);
  if (!APPLY) { await db.end(); return; }

  const ids = ok.map((r) => r.id);
  const [backup] = await db.query(`SELECT * FROM product_stock_locations WHERE product_id IN (${ids.map(() => '?').join(',')})`, ids);
  const file = `/var/www/mdv-api/backups/stock-locations-reconcile-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify({ products: ok, locations: backup }));
  console.log('backup', file);
  const key = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || process.env.SYNC_SECRET;
  let done = 0; const failed = [];
  for (const r of ok) {
    const res = await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/products/stock`, { method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': key }, body: JSON.stringify({ bling_id: r.bling_id, stock_quantity: r.bling }) });
    if (res.ok) done += 1; else failed.push(`${r.sku}:${res.status}`);
  }
  const changed = [];
  for (let i = 0; i < changed.length; i += 100) {
    await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/marketplace-stock/resync`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': key }, body: JSON.stringify({ product_ids: changed.slice(i, i + 100) }) });
  }
  const [[left]] = await db.query(`SELECT COUNT(*) n FROM products p WHERE EXISTS (SELECT 1 FROM product_stock_locations l WHERE l.product_id=p.id)
      AND p.stock_quantity <> (SELECT COALESCE(SUM(quantity),0) FROM product_stock_locations l WHERE l.product_id=p.id)`);
  console.log(JSON.stringify({ aplicados: done, falhas: failed, marketplacesResync: changed.length, divergentesRestantes: left.n }));
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
