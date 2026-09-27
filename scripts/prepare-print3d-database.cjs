'use strict';

const { Client } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path:path.join(__dirname, '..', file), quiet:true });
}

const root = path.join(__dirname, '..');
const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const appDir = '/var/www/mdv-api';
const migrationNumbers = ['028','029','030','033','034','035','036','037','038','040','041','042','043','044','045','046','047','048','049','050','051'];
const container = `mdv-print3d-homolog-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
const mysqlPassword = crypto.randomBytes(24).toString('hex');
const ssh = new Client();

if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH configuration');

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

function prepareBackupSource() {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const backupDir = BACKUP_DIR;
  const env = require('dotenv').parse(fs.readFileSync('.env'));
  const mysql = require('mysql2/promise');
  (async () => {
    const db = await mysql.createConnection({ host:env.DB_HOST, user:env.DB_USER, password:env.DB_PASS, database:env.DB_NAME });
    let estimatedBytes;
    try {
      const [[size]] = await db.query('SELECT COALESCE(SUM(DATA_LENGTH+INDEX_LENGTH),0) bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
      estimatedBytes = Number(size.bytes || 0);
    } finally { await db.end(); }
    const availableKb = Number(cp.execFileSync('df', ['-Pk', '.'], { encoding:'utf8' }).trim().split(/\n/).pop().trim().split(/\s+/)[3]);
    if (!Number.isFinite(availableKb) || availableKb * 1024 < estimatedBytes * 3 + 100 * 1024 * 1024) throw new Error('Insufficient free space for protected database backup');
    fs.mkdirSync(backupDir, { recursive:true, mode:0o700 });
    fs.chmodSync(backupDir, 0o700);
    let tool;
    for (const name of ['mysqldump','mariadb-dump']) {
      try { cp.execFileSync(name, ['--version'], { stdio:'ignore' }); tool=name; break; } catch {}
    }
    if (!tool) throw new Error('No database dump tool');
    const dumpHost = ['localhost','::1'].includes(String(env.DB_HOST || '').trim().toLowerCase()) ? '127.0.0.1' : env.DB_HOST;
    const common = ['--protocol=TCP','--single-transaction','--skip-lock-tables','--quick','--hex-blob','--no-tablespaces','--default-character-set=utf8mb4',
      '--host='+dumpHost,'--port='+(env.DB_PORT || '3306'),'--user='+env.DB_USER,env.DB_NAME];
    const dump = (name, extra=[]) => {
      const target = backupDir + '/' + name;
      const fd = fs.openSync(target, 'wx', 0o600);
      try { cp.execFileSync(tool, [...common.slice(0,-1),...extra,common.at(-1)], { env:{...process.env,MYSQL_PWD:env.DB_PASS}, stdio:['ignore',fd,'pipe'] }); }
      finally { fs.closeSync(fd); }
      const stat = fs.statSync(target);
      if (stat.size < 100) throw new Error('Invalid database dump: '+name);
      const sha256 = cp.execFileSync('sha256sum', [target], { encoding:'utf8' }).trim().split(/\s+/)[0];
      return { path:target, bytes:stat.size, sha256 };
    };
    const full = dump('database-full.sql');
    const schema = dump('database-schema.sql',['--no-data','--routines','--events','--triggers']);
    fs.writeFileSync(backupDir+'/manifest.json', JSON.stringify({ created_at:new Date().toISOString(), database:env.DB_NAME, estimated_bytes:estimatedBytes, full, schema }, null, 2), { mode:0o600, flag:'wx' });
    console.log(JSON.stringify({ backup_dir:backupDir, estimated_bytes:estimatedBytes,
      full:{ path:full.path, bytes:full.bytes, sha256:full.sha256 }, schema:{ path:schema.path, bytes:schema.bytes, sha256:schema.sha256 } }));
  })().catch(error => {
    try { fs.rmSync(backupDir, { recursive:true, force:true }); } catch {}
    console.error(error.code || error.message);
    process.exit(1);
  });
}

function docker(args, options={}) {
  const result = spawnSync('docker', args, { encoding:'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker ${args[0]} failed`);
  return result.stdout;
}

function waitForMysql() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const result = spawnSync('docker', ['exec','-e',`MYSQL_PWD=${mysqlPassword}`,container,'mysql','-uroot','--batch','--skip-column-names','-e','SELECT 1'], { encoding:'utf8' });
    if (result.status === 0 && result.stdout.trim() === '1') return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('Disposable MySQL did not become ready');
}

function withSftp(callback) {
  return new Promise((resolve, reject) => {
    ssh.sftp((error, sftp) => {
      if (error) return reject(error);
      Promise.resolve(callback(sftp)).then(resolve, reject).finally(() => sftp.end());
    });
  });
}

function restoreFromRemote(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    const mysql = spawn('docker', ['exec','-i','-e',`MYSQL_PWD=${mysqlPassword}`,container,'mysql','-uroot','mdv_homologation'], { stdio:['pipe','pipe','pipe'] });
    const source = sftp.createReadStream(remotePath);
    let stderr = '';
    mysql.stderr.on('data', chunk => { stderr += chunk.toString(); });
    mysql.stdout.resume();
    source.on('error', reject);
    mysql.on('error', reject);
    mysql.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `MySQL restore failed (${code})`)));
    source.pipe(mysql.stdin);
  });
}

function runSql(sql, { silent=false }={}) {
  const result = spawnSync('docker', ['exec','-i','-e',`MYSQL_PWD=${mysqlPassword}`,container,'mysql','-uroot','--batch','--skip-column-names','mdv_homologation'], { input:sql, encoding:'utf8', maxBuffer:20*1024*1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'MySQL command failed');
  return silent ? '' : result.stdout.trim();
}

function migrationFiles() {
  return migrationNumbers.map(number => {
    const matches = fs.readdirSync(path.join(root,'migrations')).filter(name => name.startsWith(number+'_') && name.endsWith('.sql'));
    if (matches.length !== 1) throw new Error(`Expected one migration ${number}`);
    return { number, file:path.join(root,'migrations',matches[0]) };
  });
}

async function main() {
  docker(['info']);
  await new Promise((resolve, reject) => {
    ssh.on('ready', resolve);
    ssh.on('error', reject);
    ssh.connect({ host, port:22, username, password, privateKey, readyTimeout:20000 });
  });
  const processes = JSON.parse(await execRemote('pm2 jlist'));
  const api = processes.filter(item => item.name === 'mdv-api');
  if (api.length !== 1 || api[0].pm2_env?.pm_cwd !== appDir) throw new Error('Unexpected API target');
  const stamp = new Date().toISOString().replace(/[^0-9]/g,'');
  const backupDir = `${appDir}/.deploy-backups/print3d-db-preflight-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
  const source = `(${prepareBackupSource.toString()})()`
    .replace('BACKUP_DIR', JSON.stringify(backupDir));
  const backup = JSON.parse((await execRemote(nodeCommand(source))).trim());
  console.log(JSON.stringify({ phase:'backup_created', backup_dir:backup.backup_dir, full_bytes:backup.full.bytes, schema_bytes:backup.schema.bytes }));

  let homologation;
  try {
    docker(['run','-d','--name',container,'-e',`MYSQL_ROOT_PASSWORD=${mysqlPassword}`,'-e','MYSQL_DATABASE=mdv_homologation','mysql:8.4']);
    waitForMysql();
    await withSftp(sftp => restoreFromRemote(sftp, backup.full.path));
    const before = runSql("SELECT CONCAT((SELECT COUNT(*) FROM products),'|',(SELECT COUNT(*) FROM orders),'|',(SELECT COUNT(*) FROM banners));");
    for (const migration of migrationFiles()) runSql(fs.readFileSync(migration.file,'utf8'), { silent:true });
    const after = runSql("SELECT CONCAT((SELECT COUNT(*) FROM products),'|',(SELECT COUNT(*) FROM orders),'|',(SELECT COUNT(*) FROM banners));");
    if (before !== after) throw new Error(`Core row counts changed during homologation: ${before} -> ${after}`);
    const expectedTables = ['print3d_recipe_revisions','print3d_recipe_files','print3d_active_recipes','print3d_customers','print3d_customer_auth','print3d_customer_tokens','print3d_phone_verifications','print3d_phone_verification_limits','print3d_login_limits','customer_login_limits','print3d_customer_google','print3d_google_handoffs','print3d_production_jobs','print3d_production_events','print3d_order_plans','print3d_order_item_plans','print3d_order_payment_receipts','print3d_checkout_requests','print3d_order_shipping','print3d_order_stock_reservations','print3d_payment_charges','print3d_order_cancellation_events','print3d_production_outputs','print3d_filament_stock','print3d_filament_movements','print3d_order_dispatches','print3d_supply_stock','print3d_supply_movements'];
    const present = Number(runSql(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${expectedTables.map(quote).join(',')});`));
    if (present !== expectedTables.length) throw new Error(`Homologation missing tables: ${present}/${expectedTables.length}`);
    const requiredColumns = Number(runSql("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME,COLUMN_NAME) IN (('orders','storefront'),('orders','print3d_customer_id'),('print3d_customers','phone_verified_at'),('print3d_order_plans','payment_terms_version'),('print3d_production_events','material_consumed_grams'),('print3d_order_item_plans','variant_snapshot'));"));
    if (requiredColumns !== 6) throw new Error(`Homologation missing required columns: ${requiredColumns}/6`);
    homologation = { restored:true, migrations_applied:migrationNumbers, core_row_counts:before, expected_tables:present, required_columns:requiredColumns };
  } finally {
    spawnSync('docker', ['rm','-f',container], { stdio:'ignore' });
  }
  console.log(JSON.stringify({ backup, homologation }, null, 2));
}

main().finally(() => ssh.end()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
