const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

for (const file of ['.env.vps.local', '.env.local', '.env', '.env.production']) {
  require('dotenv').config({ path: path.join(__dirname, '..', file) });
}

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

const input = {
  saleId: readArg('sale-id'),
  oldIdentifier: readArg('old-identifier'),
  newIdentifier: readArg('new-identifier'),
  reason: readArg('reason') || 'Correcao administrativa de unidade serializada informada na venda',
  execute: process.argv.includes('--execute'),
};

if (!input.saleId || !input.oldIdentifier || !input.newIdentifier) {
  throw new Error('Use --sale-id=UUID --old-identifier=IMEI --new-identifier=IMEI [--execute]');
}
if (input.oldIdentifier === input.newIdentifier) throw new Error('Os identificadores antigo e novo devem ser diferentes.');

const config = {
  host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
  username: process.env.VPS_SITE_USER || process.env.VPS_USER,
  password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD,
};
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
if (privateKeyPath) config.privateKey = fs.readFileSync(privateKeyPath);
if (!config.host || !config.username || (!config.password && !config.privateKey)) throw new Error('Credenciais SSH da VPS nao configuradas.');

const remoteProgram = String.raw`
;(async () => {
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config({ path: '/var/www/mdv-api/.env' });
const input = JSON.parse(Buffer.from(process.argv[1], 'base64url').toString('utf8'));
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const capacity = (value) => normalize(value).replace(/\s+/g, '').replace(/gib\b/g, 'gb');
const parseSpecs = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const mask = (value) => {
  const text = String(value || '');
  return text.length <= 6 ? '***' : text.slice(0, 3) + '*'.repeat(Math.max(3, text.length - 6)) + text.slice(-3);
};
const equivalent = (a, b) => {
  const as = parseSpecs(a.specs); const bs = parseSpecs(b.specs);
  return normalize(a.model_id) === normalize(b.model_id)
    && normalize(a.sku) === normalize(b.sku)
    && capacity(as.ram) === capacity(bs.ram)
    && capacity(as.storage || as.armazenamento) === capacity(bs.storage || bs.armazenamento)
    && normalize(as.color || as.cor) === normalize(bs.color || bs.cor)
    && normalize(as.version || as.versao) === normalize(bs.version || bs.versao);
};
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 1,
});
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  const [sales] = await conn.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [input.saleId]);
  if (sales.length !== 1) throw new Error('Venda nao encontrada ou duplicada.');
  const [units] = await conn.query(
    'SELECT u.*, p.company_id, p.model_id, p.sku, p.name, p.specs, p.ean, p.bling_id ' +
    'FROM units u JOIN products p ON p.id = u.product_id ' +
    'WHERE LOWER(TRIM(u.imei_1)) IN (?,?) OR LOWER(TRIM(u.imei_2)) IN (?,?) OR LOWER(TRIM(u.serial)) IN (?,?) FOR UPDATE',
    [input.oldIdentifier.toLowerCase(), input.newIdentifier.toLowerCase(), input.oldIdentifier.toLowerCase(), input.newIdentifier.toLowerCase(), input.oldIdentifier.toLowerCase(), input.newIdentifier.toLowerCase()]
  );
  const matches = (identifier) => units.filter((unit) => [unit.imei_1, unit.imei_2, unit.serial].some((value) => normalize(value) === normalize(identifier)));
  const oldMatches = matches(input.oldIdentifier); const newMatches = matches(input.newIdentifier);
  if (oldMatches.length !== 1 || newMatches.length !== 1) throw new Error('Cada identificador deve corresponder a exatamente uma unidade.');
  const oldUnit = oldMatches[0]; const newUnit = newMatches[0];
  if (oldUnit.id === newUnit.id) throw new Error('Os identificadores pertencem a mesma unidade.');
  const unitsShareCompany = String(oldUnit.company_id || '') === String(newUnit.company_id || '');
  const saleHasCompany = Boolean(sales[0].company_id);
  const saleMatchesUnitsCompany = !saleHasCompany || String(oldUnit.company_id || '') === String(sales[0].company_id || '');
  if (!unitsShareCompany || !saleMatchesUnitsCompany) {
    throw new Error('Venda e unidades pertencem a empresas diferentes ' + JSON.stringify({ unitsShareCompany, saleHasCompany, saleMatchesUnitsCompany }) + '.');
  }
  if (!equivalent(oldUnit, newUnit)) throw new Error('As unidades nao pertencem a mesma variacao comercial.');
  if (normalize(oldUnit.status) !== 'sold' || String(oldUnit.sale_id || '') !== input.saleId) throw new Error('A unidade antiga nao esta vendida nesta venda.');
  if (normalize(newUnit.status) !== 'available' || newUnit.sale_id || newUnit.order_id) throw new Error('A nova unidade nao esta livre para venda.');

  const [saleItems] = await conn.query(
    'SELECT * FROM sale_items WHERE sale_id = ? AND (serialized_unit_id = ? OR LOWER(TRIM(imei)) = ?) FOR UPDATE',
    [input.saleId, oldUnit.id, input.oldIdentifier.toLowerCase()]
  );
  if (saleItems.length !== 1) throw new Error('A unidade antiga deve estar ligada a exatamente um item da venda.');
  const item = saleItems[0];
  const [warrantyColumns] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warranty_documents'");
  const warrantyColumnNames = new Set(warrantyColumns.map((row) => row.COLUMN_NAME));
  let warrantyCount = 0;
  if (warrantyColumnNames.size > 0 && warrantyColumnNames.has('sale_id')) {
    const [countRows] = await conn.query('SELECT COUNT(*) AS total FROM warranty_documents WHERE sale_id = ?', [input.saleId]);
    warrantyCount = Number(countRows[0]?.total || 0);
  }
  const [signedRows] = await conn.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'signed_warranty_documents'");
  const [swapLogRows] = await conn.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_swap_logs'");
  const hasSwapLogTable = Number(swapLogRows[0]?.total || 0) > 0;
  let signedWarrantyCount = 0;
  if (Number(signedRows[0]?.total || 0) > 0) {
    const [countRows] = await conn.query('SELECT COUNT(*) AS total FROM signed_warranty_documents WHERE sale_id = ? AND is_active = 1', [input.saleId]);
    signedWarrantyCount = Number(countRows[0]?.total || 0);
  }

  const audit = {
    ok: true,
    mode: input.execute ? 'execute' : 'dry-run',
    sale_code: sales[0].sale_number || sales[0].order_number || input.saleId.slice(0, 8),
    old: { id: oldUnit.id, identifier: mask(input.oldIdentifier), status: oldUnit.status, product_id: oldUnit.product_id },
    replacement: { id: newUnit.id, identifier: mask(input.newIdentifier), status: newUnit.status, product_id: newUnit.product_id },
    equivalent_commercial_variation: true,
    sale_item_id: item.id,
    warranty_documents: warrantyCount,
    signed_warranty_documents: signedWarrantyCount,
    audit_storage: hasSwapLogTable ? 'unit_swap_logs_and_unit_notes' : 'unit_notes',
  };

  if (!input.execute) {
    await conn.rollback();
    console.log(JSON.stringify(audit));
    process.exitCode = 0;
  } else {
    await conn.query(
      "UPDATE units SET status='available', order_id=NULL, sale_id=NULL, reserved_at=NULL, sold_at=NULL, " +
      "internal_notes=CONCAT_WS(' | ', NULLIF(internal_notes,''), ?) WHERE id=?",
      ['Liberada por correcao administrativa de venda', oldUnit.id]
    );
    await conn.query(
      "UPDATE units SET status='sold', order_id=?, sale_id=?, reserved_at=NULL, sold_at=?, " +
      "internal_notes=CONCAT_WS(' | ', NULLIF(internal_notes,''), ?) WHERE id=?",
      [oldUnit.order_id || null, input.saleId, oldUnit.sold_at || new Date(), 'Vinculada por correcao administrativa de venda', newUnit.id]
    );
    const newIdentifier = newUnit.imei_1 || newUnit.serial || newUnit.imei_2;
    await conn.query(
      'UPDATE sale_items SET product_id=?, serialized_unit_id=?, imei=?, unit_cost=? WHERE id=?',
      [newUnit.product_id, newUnit.id, newIdentifier, newUnit.cost_price ?? item.unit_cost, item.id]
    );
    if (oldUnit.order_id) {
      await conn.query('UPDATE order_items SET product_id=?, serialized_unit_id=? WHERE order_id=? AND serialized_unit_id=?', [newUnit.product_id, newUnit.id, oldUnit.order_id, oldUnit.id]);
    }
    if (warrantyColumnNames.has('serialized_unit_id')) {
      await conn.query('UPDATE warranty_documents SET serialized_unit_id=? WHERE sale_id=? AND serialized_unit_id=?', [newUnit.id, input.saleId, oldUnit.id]);
    }
    if (warrantyColumnNames.has('warranty_content')) {
      await conn.query('UPDATE warranty_documents SET warranty_content=REPLACE(warranty_content, ?, ?) WHERE sale_id=?', [input.oldIdentifier, newIdentifier, input.saleId]);
    }
    if (hasSwapLogTable) {
      await conn.query(
        'INSERT INTO unit_swap_logs (id, company_id, order_id, sale_id, old_unit_id, new_unit_id, reason, swapped_by, created_at) ' +
        'VALUES (?,?,?,?,?,?,?,?,NOW())',
        [crypto.randomUUID(), sales[0].company_id || oldUnit.company_id, oldUnit.order_id || null, input.saleId, oldUnit.id, newUnit.id, input.reason, 'codex-admin-authorized']
      );
    }
    for (const productId of [...new Set([oldUnit.product_id, newUnit.product_id])]) {
      await conn.query("UPDATE products SET stock_quantity=(SELECT COUNT(*) FROM units WHERE product_id=? AND status='available') WHERE id=?", [productId, productId]);
    }
    await conn.commit();
    const [verified] = await conn.query('SELECT id,status,sale_id FROM units WHERE id IN (?,?) ORDER BY id', [oldUnit.id, newUnit.id]);
    audit.committed = true;
    audit.verified = verified.map((unit) => ({ id: unit.id, status: unit.status, linked_to_sale: String(unit.sale_id || '') === input.saleId }));
    console.log(JSON.stringify(audit));
  }
} catch (error) {
  try { await conn.rollback(); } catch {}
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
`;

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

const payload = Buffer.from(JSON.stringify(input)).toString('base64url');
const encodedProgram = Buffer.from(remoteProgram).toString('base64');
const command = `cd /var/www/mdv-api && node -e ${shellQuote(`eval(Buffer.from('${encodedProgram}','base64').toString('utf8'))`)} ${shellQuote(payload)}`;
const connection = new Client();
connection.on('ready', () => {
  connection.exec(command, (error, stream) => {
    if (error) throw error;
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk.toString(); });
    stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    stream.on('close', (code) => {
      connection.end();
      if (stdout.trim()) console.log(stdout.trim());
      if (stderr.trim()) console.error(stderr.trim());
      process.exitCode = code || 0;
    });
  });
});
connection.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
connection.connect(config);
