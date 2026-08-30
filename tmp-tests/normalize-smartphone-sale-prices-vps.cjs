'use strict';

const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const APPLY = process.argv.includes('--apply');
const root = path.resolve(__dirname, '..');
for (const envFile of ['.env.vps.local', '.env.local']) require('dotenv').config({ path: path.join(root, envFile), quiet: true });

function exec(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  try {
    const remoteCode = `
      require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
      const mysql = require('mysql2/promise');
      const { normalizePhysicalRamValue } = require('/var/www/mdv-api/services/physicalRamCore.cjs');
      const APPLY = ${APPLY ? 'true' : 'false'};
      const safeJson = (value) => { if (value && typeof value === 'object') return value; try { return JSON.parse(value || '{}'); } catch { return {}; } };
      const normalizeStorage = (value) => { const text = String(value || '').replace(/\\s+/g, '').toUpperCase(); const match = text.match(/^(\\d+)(GB|G|TB|T)$/); return match ? match[1] + (match[2].startsWith('T') ? 'TB' : 'GB') : text; };
      const spec = (product, keys) => { const specs = safeJson(product.specs); const custom = safeJson(product.custom_fields); for (const key of keys) { if (specs[key] != null && specs[key] !== '') return specs[key]; if (custom[key] != null && custom[key] !== '') return custom[key]; } return ''; };
      (async () => {
        const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const [rows] = await connection.query(\`SELECT p.id,p.name,p.sku,p.model_id,p.status,p.stock_quantity,p.price_retail,p.price_reseller,p.price_wholesale,p.specs,p.custom_fields,
              (SELECT MAX(i.completed_at) FROM smartphone_photo_intakes i WHERE i.matched_product_id=p.id AND i.status='completed') AS intake_completed_at
            FROM products p WHERE p.model_id IS NOT NULL AND p.status='active' AND p.stock_quantity > 0
              AND COALESCE(p.hide_from_catalog,0)=0 AND COALESCE(p.is_parent,0)=0 FOR UPDATE\`);
          const groups = new Map();
          for (const product of rows) {
            const ram = normalizePhysicalRamValue(spec(product, ['ram_fisica','memoria_ram_fisica','ram','memoria_ram','memory_ram']));
            const storage = normalizeStorage(spec(product, ['storage','armazenamento','memoria','capacity']));
            if (!ram || !storage) continue;
            const key = [product.model_id, ram, storage].join('|');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(product);
          }
          const changes = [];
          for (const [key, products] of groups) {
            if (products.length < 2) continue;
            const source = products
              .filter((product) => product.intake_completed_at)
              .sort((left, right) => new Date(right.intake_completed_at).getTime() - new Date(left.intake_completed_at).getTime())[0];
            if (!source) continue;
            const canonical = {
              price_retail: Number(source.price_retail || 0),
              price_reseller: Number(source.price_reseller || 0),
              price_wholesale: Number(source.price_wholesale || 0),
            };
            const divergent = products.filter((product) => ['price_retail','price_reseller','price_wholesale'].some((field) => Number(product[field] || 0) !== canonical[field]));
            if (!divergent.length) continue;
            changes.push({ key, source: { id: source.id, sku: source.sku, completed_at: source.intake_completed_at }, canonical, products: products.map((product) => ({ id: product.id, sku: product.sku, name: product.name, price_retail: product.price_retail, price_reseller: product.price_reseller, price_wholesale: product.price_wholesale })) });
            if (APPLY) {
              const ids = products.map((product) => product.id);
              await connection.query(\`UPDATE products SET price_retail=?,price_reseller=?,price_wholesale=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (\${ids.map(() => '?').join(',')})\`, [canonical.price_retail, canonical.price_reseller, canonical.price_wholesale, ...ids]);
            }
          }
          if (APPLY) await connection.commit(); else await connection.rollback();
          console.log(JSON.stringify({ apply: APPLY, changed_groups: changes.length, changed_products: changes.reduce((sum, group) => sum + group.products.length, 0), changes }, null, 2));
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); await pool.end(); }
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const encoded = Buffer.from(remoteCode, 'utf8').toString('base64');
    const output = await exec(conn, `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`);
    console.log(output);
  } finally {
    conn.end();
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
