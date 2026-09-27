'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TARGET = '/var/www/mdv-api';
const TABLES = ['products', 'banners', 'product_storefront_offers'];
const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";

// Runs inside the existing API directory. Never return credentials or customer rows.
async function remoteCheck() {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const envFile = require('dotenv').parse(fs.readFileSync('.env'));
  const processes = JSON.parse(cp.execFileSync('pm2', ['jlist'], { encoding: 'utf8' }));
  const matches = processes.filter(p => p.name === 'mdv-api');
  if (matches.length !== 1) throw new Error('Expected exactly one mdv-api process');
  const pm = matches[0].pm2_env;
  if (pm.pm_cwd !== '/var/www/mdv-api' || !['/var/www/mdv-api/vps_server.js', '/var/www/mdv-api/vps_server.cjs', '/var/www/mdv-api/server.js'].includes(pm.pm_exec_path)) throw new Error('Unexpected PM2 target');
  const pmEnv = { ...pm, ...(pm.env || {}) };
  const guarded = key => (/^MDV_PRINT3D_.*ENABLED$/.test(key) || ['MDV_CUSTOMER_AUTH_SECURITY_ENABLED', 'MDV_STOREFRONT_MDV_READY'].includes(key));
  for (const source of [envFile, pmEnv]) for (const [key, value] of Object.entries(source)) {
    if (guarded(key) && !['', '0', 'false'].includes(String(value).toLowerCase())) throw new Error('Feature must remain disabled: ' + key);
  }
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME']) {
    if (!envFile[key] || (pmEnv[key] !== undefined && String(pmEnv[key]) !== envFile[key])) throw new Error('Missing or conflicting database setting: ' + key);
  }
  const connection = await require('mysql2/promise').createConnection({ host: envFile.DB_HOST, user: envFile.DB_USER, password: envFile.DB_PASS, database: envFile.DB_NAME });
  try {
    const [columns] = await connection.query("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','banners','product_storefront_offers')");
    const [indexes] = await connection.query("SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','banners','product_storefront_offers')");
    const [tables] = await connection.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('products','banners','product_storefront_offers')");
    const counts = {};
    for (const table of tables) {
      const [[row]] = await connection.query('SELECT COUNT(*) AS n FROM `' + table.TABLE_NAME + '`'); counts[table.TABLE_NAME] = String(row.n);
    }
    let google = false;
    try { require.resolve('google-auth-library'); google = true; } catch {}
    const port = Number(pmEnv.PORT || envFile.PORT || 4000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port');
    return { columns, indexes, tables, counts, google, script: pm.pm_exec_path, port };
  } finally { await connection.end(); }
}

function schemaPlan(state, migrations) {
  const columns = table => state.columns.filter(c => c.TABLE_NAME === table);
  const find = (table, name) => columns(table).find(c => c.COLUMN_NAME === name);
  for (const table of ['products', 'banners']) {
    if (!state.tables.some(t => t.TABLE_NAME === table && t.ENGINE === 'InnoDB')) throw new Error('Expected existing InnoDB table: ' + table);
  }
  const id = find('products', 'id');
  if (!id || !/^char\(36\)$/i.test(id.COLUMN_TYPE) || !/^[a-z0-9]+_[a-z0-9_]+$/.test(id.COLLATION_NAME || '')) throw new Error('Ambiguous products.id type/collation');
  const indexes = (table, name, expected, unique = false) => {
    const actual = state.indexes.filter(i => i.TABLE_NAME === table && i.INDEX_NAME === name).sort((a,b) => a.SEQ_IN_INDEX-b.SEQ_IN_INDEX);
    if (actual.length !== expected.length || actual.some((i,n) => i.COLUMN_NAME !== expected[n] || (unique && Number(i.NON_UNIQUE) !== 0))) throw new Error('Unexpected index ' + table + '.' + name);
  };
  const sql = [];
  const productNames = ['is_print3d', 'print3d_preorder_enabled', 'print3d_preorder_limit'];
  const present = productNames.filter(name => find('products', name));
  if (present.length && present.length !== productNames.length) throw new Error('Partial migration 031 requires manual review');
  if (!present.length) sql.push(migrations['031']);
  else {
    for (const name of productNames.slice(0,2)) {
      const col = find('products', name);
      if (!/^tinyint(?:\(1\))?$/i.test(col.COLUMN_TYPE) || col.IS_NULLABLE !== 'NO' || String(col.COLUMN_DEFAULT) !== '0') throw new Error('Unexpected product flag schema');
    }
    const limit = find('products', productNames[2]);
    if (!/^int(?:\(\d+\))? unsigned$/i.test(limit.COLUMN_TYPE) || limit.IS_NULLABLE !== 'YES') throw new Error('Unexpected preorder limit schema');
    indexes('products', 'idx_products_print3d_catalog', ['is_print3d','status']);
  }
  const offerColumns = columns('product_storefront_offers');
  if (!offerColumns.length) {
    const collation = id.COLLATION_NAME;
    const charset = collation.split('_')[0];
    sql.push(migrations['032'].replace('product_id CHAR(36) NOT NULL', `product_id CHAR(36) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL`));
  } else {
    const expected = ['product_id','storefront','publication_status','title','description','category_label','slug','price_retail','price_reseller','price_wholesale','price_promo','promo_start','promo_end','meta_title','meta_description','updated_at'];
    if (expected.some(n => !find('product_storefront_offers', n))) throw new Error('Incomplete storefront offer schema');
    if (find('product_storefront_offers','product_id').COLLATION_NAME !== id.COLLATION_NAME) throw new Error('Offer/product collation mismatch');
    indexes('product_storefront_offers','PRIMARY',['product_id','storefront'],true);
    indexes('product_storefront_offers','uq_storefront_slug',['storefront','slug'],true);
  }
  const banner = find('banners', 'storefront');
  if (!banner) sql.push(migrations['039']);
  else {
    if (banner.COLUMN_TYPE !== 'varchar(32)' || banner.IS_NULLABLE !== 'NO' || banner.COLUMN_DEFAULT !== 'mercado_do_vale') throw new Error('Unexpected banner storefront schema');
    indexes('banners','idx_banners_storefront_order',['storefront','display_order']);
  }
  return sql;
}

function nodeCommand(appDir, source) {
  const encoded = Buffer.from(source).toString('base64');
  return `cd ${quote(appDir)} && node -e ${quote("eval(Buffer.from('" + encoded + "','base64').toString())")}`;
}

async function waitForHealth({ port = 4000, timeoutMs = 30000, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  getProcesses = timeout => JSON.parse(require('node:child_process').execFileSync('pm2', ['jlist'], { encoding:'utf8', timeout })),
  request = (url, timeout) => fetch(url, { signal:AbortSignal.timeout(timeout) }),
} = {}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    try {
      const processes = await getProcesses(Math.max(1, Math.min(2000, deadline - now())));
      const matches = processes.filter(process => process.name === 'mdv-api');
      if (matches.length === 1 && matches[0].pm2_env?.status === 'online' && now() < deadline) {
        const response = await request(`http://127.0.0.1:${port}/status`, Math.max(1, Math.min(3000, deadline - now())));
        if (response.ok) {
          const status = await response.json();
          if (status.ok === true && status.mysql?.ok === true) return { ok:true, mysql:{ok:true}, process:'online' };
        }
      }
    } catch { /* Allow the process to finish booting, with a bounded deadline. */ }
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(1000,remaining));
  }
  throw new Error('API health check failed: mdv-api and MySQL must be healthy within 30 seconds');
}

async function deployPrint3d({ appDir, apiProc, exec, upload, root, checkOnly = false, runtimeFiles = [] }) {
  if (appDir !== TARGET || (typeof apiProc === 'string' ? apiProc : apiProc?.name) !== 'mdv-api') throw new Error('Unexpected deployment target');
  const migrations = Object.fromEntries(['031','032','039'].map(number => {
    const files = fs.readdirSync(path.join(root,'migrations')).filter(f => f.startsWith(number + '_') && f.endsWith('.sql'));
    if (files.length !== 1) throw new Error('Ambiguous migration ' + number);
    return [number, fs.readFileSync(path.join(root,'migrations',files[0]),'utf8')];
  }));
  const check = async () => JSON.parse(await exec(nodeCommand(appDir, `(${remoteCheck.toString()})().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exit(1)})`)));
  const state = await check();
  const ddl = schemaPlan(state, migrations);
  if (checkOnly) return { checkOnly: true, pendingMigrations: ddl.length, googleInstalled: state.google, counts: state.counts };
  const files = [...new Set([...runtimeFiles,'services/customerPhoneVerificationServer.cjs','vps_server.cjs','vps_server.js', ...(state.script === appDir+'/server.js' ? ['server.js'] : [])])];
  const localFile = file => path.join(root, file === 'server.js' ? 'vps_server.js' : file);
  for (const file of files) {
    if (!/^(?:services\/|utils\/|vps_server\.|server\.js$)/.test(file) || file.includes('..') || !/^[a-zA-Z0-9_./-]+$/.test(file) || !fs.statSync(localFile(file)).isFile()) throw new Error('Invalid runtime path: ' + file);
  }
  const release = 'print3d-' + new Date().toISOString().replace(/[^0-9]/g,'') + '-' + crypto.randomBytes(3).toString('hex');
  const backup = `${appDir}/.deploy-backups/${release}`;
  const stage = `${appDir}/.deploy-stage/${release}`;
  await exec(`umask 077 && mkdir -p ${quote(backup)} ${quote(stage)} && chmod 700 ${quote(appDir+'/.deploy-backups')} ${quote(appDir+'/.deploy-stage')}`);
  // Dump full rows plus definitions for ONLY the affected tables, before any DDL.
  const backupSource = `const fs=require('fs'),cp=require('child_process'); const e=require('dotenv').parse(fs.readFileSync('.env')); const out=fs.openSync(${JSON.stringify(backup+'/database.sql')},'wx',0o600); try { let tool; for(const name of ['mysqldump','mariadb-dump']) { try { cp.execFileSync(name,['--version'],{stdio:'ignore'});tool=name;break; }catch{} } if(!tool)throw Error('No database dump tool'); cp.execFileSync(tool,['--single-transaction','--skip-lock-tables','--hex-blob','--no-tablespaces','--host='+e.DB_HOST,'--user='+e.DB_USER,e.DB_NAME,...${JSON.stringify(Object.keys(state.counts).filter(t=>TABLES.includes(t)))}],{env:{...process.env,MYSQL_PWD:e.DB_PASS},stdio:['ignore',out,'pipe']}); } finally{fs.closeSync(out)} if(fs.statSync(${JSON.stringify(backup+'/database.sql')}).size<100)throw Error('Invalid database backup'); console.log('Database backup saved');`;
  await exec(nodeCommand(appDir, backupSource));
  for (const file of files) {
    await exec(`mkdir -p ${quote(path.posix.dirname(stage+'/'+file))} ${quote(path.posix.dirname(backup+'/files/'+file))} && if test -f ${quote(appDir+'/'+file)}; then cp -p ${quote(appDir+'/'+file)} ${quote(backup+'/files/'+file)}; fi`);
    await upload(localFile(file),stage+'/'+file);
  }
  if (!state.google) await exec(`cd ${quote(appDir)} && npm install --no-save --package-lock=false --ignore-scripts --omit=dev google-auth-library@10.9.1`);
  // Parse every staged file; resolve static requires from its final relative path.
  const validateSource = `const fs=require('fs'),cp=require('child_process'),path=require('path'),Module=require('module'); for(const file of ${JSON.stringify(files)}) { const staged=${JSON.stringify(stage)}+'/'+file; const text=fs.readFileSync(staged,'utf8'); cp.execFileSync(process.execPath,['--check','--input-type='+ (file.endsWith('.mjs')?'module':'commonjs')],{input:text,stdio:['pipe','pipe','pipe']}); const req=Module.createRequire(${JSON.stringify(appDir)}+'/'+file); for(const match of text.matchAll(/require\\(\\s*['"]([^'"]+)['"]\\s*\\)/g)) { const dep=match[1]; if(dep.startsWith('.')) { const candidate=path.resolve(path.dirname(staged),dep); if(fs.existsSync(candidate))continue; } req.resolve(dep); } } console.log('Staged runtime validated');`;
  await exec(nodeCommand(appDir,validateSource));
  // Re-check just before mutation; stop if flags/schema drifted while uploading.
  const fresh = await check();
  const freshDdl = schemaPlan(fresh,migrations);
  if (JSON.stringify(ddl)!==JSON.stringify(freshDdl)) throw new Error('Schema changed during preparation');
  if (ddl.length) {
    const migrateSource = `const fs=require('fs'); const e=require('dotenv').parse(fs.readFileSync('.env')); (async()=>{ const db=await require('mysql2/promise').createConnection({host:e.DB_HOST,user:e.DB_USER,password:e.DB_PASS,database:e.DB_NAME,multipleStatements:true});try {for(const sql of ${JSON.stringify(ddl)})await db.query(sql);}finally{await db.end()}})().catch(e=>{console.error(e.code||'Migration failed');process.exit(1)});`;
    await exec(nodeCommand(appDir,migrateSource));
  }
  const after = await check();
  if (schemaPlan(after,migrations).length) throw new Error('Schema not ready after migration');
  for (const [table,count] of Object.entries(fresh.counts)) if(after.counts[table]!==count) throw new Error('Row count changed; pause deployment for review: '+table);
  if (after.counts.product_storefront_offers !== (fresh.counts.product_storefront_offers || '0')) throw new Error('Unexpected storefront offer row count');
  const ordered = [...files.filter(f=>!['vps_server.cjs','vps_server.js','server.js'].includes(f)), 'vps_server.cjs','vps_server.js', ...(files.includes('server.js')?['server.js']:[])];
  const promoted = [];
  try {
    for (const file of ordered) {
      await exec(`mkdir -p ${quote(path.posix.dirname(appDir+'/'+file))} && cp ${quote(stage+'/'+file)} ${quote(appDir+'/'+file+'.print3d-next')} && mv ${quote(appDir+'/'+file+'.print3d-next')} ${quote(appDir+'/'+file)}`);
      promoted.push(file);
    }
    await exec('pm2 restart mdv-api');
    await exec(nodeCommand(appDir, `(${waitForHealth.toString()})({port:${after.port || 4000}}).then(()=>console.log('API and MySQL healthy')).catch(()=>{console.error('API health check failed');process.exit(1)})`));
    return { checkOnly:false,backup,stage,files:ordered.length,migrationsApplied:ddl.length,counts:after.counts,healthy:true };
  } catch(error) {
    for(const file of promoted.reverse()) await exec(`if test -f ${quote(backup+'/files/'+file)}; then cp -p ${quote(backup+'/files/'+file)} ${quote(appDir+'/'+file)}; else rm -f ${quote(appDir+'/'+file)}; fi`);
    await exec('pm2 restart mdv-api');
    throw new Error('Deployment failed; previous runtime restored. Additive schema retained. '+error.message);
  }
}

module.exports = { deployPrint3d, schemaPlan, nodeCommand, waitForHealth };
