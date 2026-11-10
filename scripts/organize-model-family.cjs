'use strict';
// Organiza a família (pai + variações) de um modelo já cadastrado, com a MESMA regra da
// Entrada única (services/smartphoneModelFamily.cjs). Não mexe em preço, custo, estoque,
// unidades nem fotos: só cria o pai (se faltar) e preenche parent_id das variações soltas.
//
// Uso na VPS (/var/www/mdv-api):
//   node scripts/organize-model-family.cjs --search "realme note 70"   # diagnóstico (somente leitura)
//   node scripts/organize-model-family.cjs --model <model_id>           # prévia (ROLLBACK)
//   node scripts/organize-model-family.cjs --model <model_id> --apply   # aplica, com backup
const fs = require('node:fs');
const path = require('node:path');
const { ensureSmartphoneModelFamily } = require(path.join(process.cwd(), 'services/smartphoneModelFamily.cjs'));

const COMPANY = '9717131e-7b14-4aec-84a4-4317c0489985';
const GUARDED = ['price_cost', 'price_retail', 'price_reseller', 'price_wholesale', 'stock_quantity', 'specs', 'images', 'status', 'model_id'];

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function connect() {
  require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
  const mysql = require('mysql2/promise');
  return mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
}

async function search(db, text) {
  const like = `%${String(text).trim().replace(/\s+/g, '%')}%`;
  const [rows] = await db.query(`SELECT p.id,p.sku,p.name,p.model_id,m.name AS model_name,p.parent_id,p.is_parent,
      p.company_id,p.status,p.stock_quantity,p.offer_type,p.is_combo,p.is_print3d,c.name AS category_name
    FROM products p LEFT JOIN models m ON m.id=p.model_id
    LEFT JOIN categories c ON c.id=COALESCE(m.category_id,p.category_id)
    WHERE p.name LIKE ? OR m.name LIKE ? ORDER BY p.model_id,p.is_parent DESC,p.name`, [like, like]);
  const byModel = {};
  for (const row of rows) (byModel[row.model_id || 'SEM_MODELO'] ||= []).push(row);
  return { mode: 'search', text, total: rows.length, models: Object.keys(byModel).length, by_model: byModel };
}

async function organize(db, modelId, apply) {
  const [[model]] = await db.query('SELECT id,name,company_id FROM models WHERE id=?', [modelId]);
  if (!model) throw new Error('Modelo não encontrado.');
  const [before] = await db.query('SELECT * FROM products WHERE model_id=? ORDER BY id', [modelId]);
  const companies = [...new Set(before.map(row => row.company_id || model.company_id || COMPANY))];
  if (companies.length !== 1) throw new Error(`Produtos do modelo em mais de uma empresa: ${companies.join(', ')}`);
  await db.beginTransaction();
  try {
    const result = await ensureSmartphoneModelFamily(db, {
      modelId, companyId: companies[0], defaultCompanyId: COMPANY, dryRun: !apply, anyCategory: true,
    });
    const summary = {
      mode: apply ? 'apply' : 'dry-run', model: model.name, parent_id: result.parent_id, parent_created: result.created,
      parent_name: result.parent?.name, variations: result.children.length, variations_to_link: result.linked_count,
    };
    if (!apply) { await db.rollback(); return summary; }
    const [after] = await db.query('SELECT * FROM products WHERE model_id=? ORDER BY id', [modelId]);
    const afterById = new Map(after.map(row => [row.id, row]));
    for (const old of before) {
      const next = afterById.get(old.id);
      if (!next) throw new Error(`Produto sumiu: ${old.id}`);
      for (const key of GUARDED) {
        if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) throw new Error(`Alteração inesperada em ${old.id}.${key}`);
      }
      if (old.parent_id && old.parent_id !== next.parent_id) throw new Error(`Variação ${old.id} trocou de pai`);
    }
    const backup = `/var/www/mdv-api/backups/model-family-${modelId}-${Date.now()}`;
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(backup, 'before.json'), JSON.stringify(before), { mode: 0o600 });
    await db.commit();
    fs.writeFileSync(path.join(backup, 'result.json'), JSON.stringify(summary), { mode: 0o600 });
    return { ...summary, backup, prices_stock_specs_preserved: true };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

async function main() {
  const db = await connect();
  try {
    const text = arg('--search');
    if (text) return await search(db, text);
    const modelId = arg('--model');
    if (!modelId) throw new Error('Use --search "<nome>" ou --model <model_id> [--apply].');
    return await organize(db, modelId, process.argv.includes('--apply'));
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
