'use strict';

const { Client } = require('ssh2');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path:path.join(__dirname, '..', file), quiet:true });
}

const root = path.join(__dirname, '..');
const appDir = '/var/www/mdv-api';
const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const apply = process.argv.includes('--apply');
const backupArg = process.argv.find(value => value.startsWith('--backup-dir='));
const backupDir = backupArg ? backupArg.slice('--backup-dir='.length) : '';
const migrationNumbers = ['028','029','030','033','034','035','036','037','038','040','041','042','043','044','045','046','047','048','049','050','051','052'];
const ssh = new Client();

if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH configuration');
if (!/^\/var\/www\/mdv-api\/\.deploy-backups\/print3d-db-preflight-[0-9]+-[a-f0-9]{6}$/.test(backupDir)) {
  throw new Error('A validated --backup-dir is required');
}

const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;

function execRemote(command) {
  return new Promise((resolve, reject) => {
    ssh.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', chunk => { stdout += chunk.toString(); });
      stream.stderr.on('data', chunk => { stderr += chunk.toString(); });
      stream.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Remote command failed (${code})`)));
    });
  });
}

function nodeCommand(source) {
  const encoded = Buffer.from(source).toString('base64');
  return `cd ${quote(appDir)} && node -e ${quote(`eval(Buffer.from('${encoded}','base64').toString())`)}`;
}

function migrations() {
  return migrationNumbers.map(number => {
    const matches = fs.readdirSync(path.join(root,'migrations')).filter(name => name.startsWith(number+'_') && name.endsWith('.sql'));
    if (matches.length !== 1) throw new Error(`Expected one migration ${number}`);
    return { number, name:matches[0], sql:fs.readFileSync(path.join(root,'migrations',matches[0]),'utf8') };
  });
}

function remoteMigrationSource() {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const crypto = require('node:crypto');
  const mysql = require('mysql2/promise');
  const env = require('dotenv').parse(fs.readFileSync('.env'));
  const backupDir = BACKUP_DIR;
  const shouldApply = SHOULD_APPLY;
  const migrationList = MIGRATIONS;
  const markers = MIGRATION_MARKERS;
  const enabledKeys = Object.keys(env).filter(key => /^MDV_PRINT3D_.*ENABLED$/.test(key) && env[key] === '1');
  if (enabledKeys.length) throw new Error('3D features must remain disabled: '+enabledKeys.join(','));
  const manifestPath = backupDir+'/manifest.json';
  if (!fs.existsSync(manifestPath)) throw new Error('Backup manifest not found');
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for (const item of [manifest.full,manifest.schema]) {
    if (!item || !fs.existsSync(item.path) || fs.statSync(item.path).size !== item.bytes || item.bytes < 100) throw new Error('Backup file validation failed');
    const checksum = cp.execFileSync('sha256sum',[item.path],{encoding:'utf8'}).trim().split(/\s+/)[0];
    if (checksum !== item.sha256) throw new Error('Backup checksum validation failed');
  }

  const inspect = async db => {
    const [tableRows] = await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    const [columnRows] = await db.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
    const tables = new Set(tableRows.map(row => row.TABLE_NAME));
    const columns = new Set(columnRows.map(row => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
    const exists = marker => marker.startsWith('table:') ? tables.has(marker.slice(6)) : columns.has(marker.slice(7));
    const migrationState = Object.fromEntries(Object.entries(markers).map(([number,items]) => [number, {
      present:items.every(exists), partial:items.some(exists) && !items.every(exists),
    }]));
    const [[counts]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM products) products,
      (SELECT COUNT(*) FROM orders) orders_count,
      (SELECT COUNT(*) FROM banners) banners,
      (SELECT COALESCE(SUM(stock_quantity),0) FROM products) product_stock,
      (SELECT COUNT(*) FROM product_stock_locations) location_rows,
      (SELECT COALESCE(SUM(quantity),0) FROM product_stock_locations) location_stock`);
    return { migrations:migrationState, counts:Object.fromEntries(Object.entries(counts).map(([key,value]) => [key,String(value)])) };
  };

  (async () => {
    const db = await mysql.createConnection({ host:env.DB_HOST, user:env.DB_USER, password:env.DB_PASS, database:env.DB_NAME, multipleStatements:true });
    let locked = false;
    try {
      const [[lock]] = await db.query("SELECT GET_LOCK('mdv_print3d_schema_migration',30) acquired");
      if (Number(lock.acquired) !== 1) throw new Error('Could not acquire migration lock');
      locked = true;
      const before = await inspect(db);
      const partial = Object.entries(before.migrations).filter(([,state]) => state.partial).map(([number]) => number);
      if (partial.length) throw new Error('Partial migration state: '+partial.join(','));
      const alreadyPresent = migrationList.filter(item => before.migrations[item.number]?.present).map(item => item.number);
      let missingSeen = false;
      for (const migration of migrationList) {
        const present = Boolean(before.migrations[migration.number]?.present);
        if (!present) missingSeen = true;
        else if (missingSeen) throw new Error('Operational migration gap before '+migration.number);
      }
      if (!shouldApply) {
        console.log(JSON.stringify({ mode:'plan', backup_valid:true, pending:migrationList.filter(item => !before.migrations[item.number]?.present).map(item => item.number), before }));
        return;
      }
      const applied = [];
      for (const migration of migrationList) {
        if (!before.migrations[migration.number]?.present) {
          await db.query(migration.sql);
          applied.push(migration.number);
        }
      }
      const after = await inspect(db);
      const missing = migrationList.filter(item => !after.migrations[item.number]?.present).map(item => item.number);
      if (missing.length) throw new Error('Post-migration markers missing: '+missing.join(','));
      if (JSON.stringify(before.counts) !== JSON.stringify(after.counts)) throw new Error('Core counts or stock totals changed during additive migrations');
      console.log(JSON.stringify({ mode:'apply', backup_valid:true, applied, already_present:alreadyPresent, before:before.counts, after:after.counts }));
    } finally {
      if (locked) await db.query("SELECT RELEASE_LOCK('mdv_print3d_schema_migration')");
      await db.end();
    }
  })().catch(error => { console.error(error.code || error.message); process.exit(1); });
}

const migrationMarkers = {
  '028':['table:print3d_recipe_revisions'], '029':['table:print3d_recipe_files'], '030':['table:print3d_active_recipes'],
  '033':['column:orders.storefront'],
  '034':['table:print3d_customers','table:print3d_customer_auth','table:print3d_customer_tokens','column:orders.print3d_customer_id'],
  '035':['column:print3d_customers.phone_verified_at','table:print3d_phone_verifications','table:print3d_phone_verification_limits'],
  '036':['table:print3d_login_limits'], '037':['table:customer_login_limits'],
  '038':['table:print3d_customer_google','table:print3d_google_handoffs'],
  '040':['table:print3d_production_jobs','table:print3d_production_events'],
  '041':['table:print3d_order_plans','table:print3d_order_item_plans','table:print3d_order_payment_receipts'],
  '042':['table:print3d_checkout_requests','table:print3d_order_shipping','table:print3d_order_stock_reservations'],
  '043':['table:print3d_payment_charges'], '044':['column:print3d_order_plans.payment_terms_version'],
  '045':['table:print3d_order_cancellation_events'], '046':['table:print3d_production_outputs'],
  '047':['column:print3d_production_events.material_consumed_grams'],
  '048':['table:print3d_filament_stock','table:print3d_filament_movements'],
  '049':['table:print3d_order_dispatches'], '050':['table:print3d_supply_stock','table:print3d_supply_movements'],
  '051':['column:print3d_order_item_plans.variant_snapshot'],
  '052':['table:print3d_file_assets','column:print3d_recipe_files.asset_id'],
};

async function main() {
  await new Promise((resolve, reject) => {
    ssh.on('ready', resolve);
    ssh.on('error', reject);
    ssh.connect({ host, port:22, username, password, privateKey, readyTimeout:20000 });
  });
  const processes = JSON.parse(await execRemote('pm2 jlist'));
  const api = processes.filter(item => item.name === 'mdv-api');
  if (api.length !== 1 || api[0].pm2_env?.pm_cwd !== appDir) throw new Error('Unexpected API target');
  const source = `(${remoteMigrationSource.toString()})()`
    .replace('BACKUP_DIR', JSON.stringify(backupDir))
    .replace('SHOULD_APPLY', JSON.stringify(apply))
    .replace('MIGRATIONS', JSON.stringify(migrations()))
    .replace('MIGRATION_MARKERS', JSON.stringify(migrationMarkers));
  console.log(JSON.stringify(JSON.parse((await execRemote(nodeCommand(source))).trim()), null, 2));
}

main().finally(() => ssh.end()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
