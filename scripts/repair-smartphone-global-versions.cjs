'use strict';
// One-off, explicitly authorized data correction. Dry-run unless --apply is supplied.
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const core = require(path.join(process.cwd(), 'services/smartphonePriceGroupsCore.cjs'));
const COMPANY = '9717131e-7b14-4aec-84a4-4317c0489985';
const REDMI = '31478b7e-95c8-43ad-a24b-72904b1d77da';
function planVersions(rows, versions) {
  const names = new Map(versions.map(v => [v.id, v.name]));
  return rows.flatMap(p => {
    if (!core.isSmartphoneCategory(p.category_name) || Number(p.is_parent) === 1 || Number(p.is_combo) === 1 || Number(p.is_print3d) === 1 || p.offer_type) return [];
    const specs = typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs || {};
    if (Array.isArray(specs) || typeof specs !== 'object') throw new Error('Invalid smartphone specs');
    if (String(specs.version || '').trim()) return [];
    const alias = String(specs.versao || '').trim();
    if (alias && String(names.get(alias) || alias).trim().toLowerCase() !== 'global') return [];
    return [{ id: p.id, specs: { ...specs, version: 'Global' } }];
  });
}
async function run({ apply = false } = {}) {
  require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
  const mysql = require('mysql2/promise');
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  let backup;
  try {
    if (!apply) await db.query('SET TRANSACTION READ ONLY');
    await db.beginTransaction();
    const [rows] = await db.query(`SELECT p.*, COALESCE(mc.name,pc.name) category_name FROM products p
      LEFT JOIN models m ON m.id=p.model_id LEFT JOIN categories mc ON mc.id=m.category_id
      LEFT JOIN categories pc ON pc.id=p.category_id WHERE COALESCE(p.company_id,m.company_id)=?${apply ? ' FOR UPDATE' : ''}`, [COMPANY]);
    const [versions] = await db.query('SELECT id,name FROM versions');
    const [groups] = await db.query('SELECT * FROM smartphone_price_groups');
    const plan = planVersions(rows, versions);
    const phones = rows.filter(p => core.isSmartphoneCategory(p.category_name) && !Number(p.is_parent) && !Number(p.is_combo) && !Number(p.is_print3d) && !p.offer_type);
    const summary = { mode: apply ? 'apply' : 'dry-run', smartphones: phones.length, missing_version: plan.length, redmi_missing: plan.filter(p => rows.find(r => r.id === p.id)?.model_id === REDMI).length };
    if (!apply) { await db.rollback(); return summary; }
    backup = `/var/www/mdv-api/backups/global-versions-${Date.now()}`;
    fs.mkdirSync(backup, { mode: 0o700 });
    fs.writeFileSync(path.join(backup, 'before.json'), JSON.stringify({ products: rows.filter(r => plan.some(p => p.id === r.id) || r.model_id === REDMI), groups }), { mode: 0o600 });
    for (const p of plan) await db.query('UPDATE products SET specs=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [JSON.stringify(p.specs), p.id]);
    const [after] = await db.query('SELECT id,specs,price_cost,price_retail,price_reseller,price_wholesale,stock_quantity FROM products WHERE id IN (?)', [rows.map(r => r.id)]);
    const byId = new Map(after.map(p => [p.id, p]));
    for (const old of rows) {
      const next = byId.get(old.id);
      for (const key of ['price_cost','price_retail','price_reseller','price_wholesale','stock_quantity']) {
        if (String(old[key]) !== String(next[key])) throw new Error('Unexpected price/stock mutation');
      }
      const expected = plan.find(p => p.id === old.id)?.specs || core.object(old.specs);
      if (!isDeepStrictEqual(core.object(next.specs), expected)) throw new Error('Unexpected specs mutation');
    }
    await db.commit();
    const result = { ...summary, backup, price_and_stock_preserved: true };
    fs.writeFileSync(path.join(backup, 'result.json'), JSON.stringify(result), { mode: 0o600 });
    return result;
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
module.exports = { planVersions, run };
if (require.main === module) run({ apply: process.argv.includes('--apply') }).then(result => console.log(JSON.stringify(result))).catch(e => { console.error(e.message); process.exitCode = 1; });
