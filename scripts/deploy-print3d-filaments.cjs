'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const { waitForHealth } = require('./deploy-print3d.cjs');
const ENTRIES = ['server.js','vps_server.js','vps_server.cjs'];
const MODULES = ['services/print3dFilaments.cjs','services/print3dFilamentsServer.cjs','services/print3dMaterialStock.cjs'];
const FLAG = 'MDV_PRINT3D_FILAMENT_STOCK_ENABLED';
const HOOK = "const filamentCatalogRoutes = require('./services/print3dFilamentsServer.cjs').registerPrint3dFilamentRoutes(fastify, {\n  pool, getBearerAuthContext:getVpsBearerAuthContext, stockEnabled:process.env.MDV_PRINT3D_FILAMENT_STOCK_ENABLED === '1',\n});\n\n";
const GET = "fastify.get('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {";
const PATCH = "fastify.patch('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {";
const COST = "  if (key === 'print3d.cost.v1') {\n    await filamentCatalogRoutes.admin(req, reply);\n    if (reply.sent) return;\n    try { return await filamentCatalogRoutes.saveCosts(req.body); }\n    catch (error) { return reply.code(error.statusCode || 500).send({ error:error.statusCode ? error.message : 'Não foi possível salvar os custos.' }); }\n  }\n\n";
function patchEntry(source) {
  let value = source.replace(/\r\n/g,'\n');
  if (!value.includes(HOOK)) {
    if (value.includes('filamentCatalogRoutes') || value.split(GET).length !== 2) throw new Error('Unexpected filament hook');
    value = value.replace(GET, HOOK + GET);
  } else if (value.split(HOOK).length !== 2) throw new Error('Duplicate filament hook');
  if (value.split(PATCH).length !== 2) throw new Error('Ambiguous preferences PATCH');
  const start = value.indexOf(PATCH);
  const anchor = '  const valueJson = normalizeAdminPreferenceValue(req.body?.value);';
  const before = value.slice(0,start), block = value.slice(start);
  if (!block.includes(COST)) {
    if (block.includes('filamentCatalogRoutes.saveCosts') || block.split(anchor).length !== 2) throw new Error('Unexpected cost hook');
    value = before + block.replace(anchor,COST + anchor);
  } else if (block.split(COST).length !== 2) throw new Error('Duplicate cost hook');
  return source.includes('\r\n') ? value.replace(/\n/g,'\r\n') : value;
}
function schemaPlan(columns) {
  const reason = columns.find(c => c.Field === 'reason'), note = columns.find(c => c.Field === 'note');
  if (reason?.Type === "enum('receipt','production')" && reason.Null === 'NO' && !note) return true;
  if (reason?.Type === "enum('receipt','production','adjustment')" && reason.Null === 'NO' && note?.Type === 'varchar(500)' && note.Null === 'YES') return false;
  throw new Error('Unexpected/partial filament schema; review required');
}
// Runs only on the explicitly selected VPS, with secrets remaining there.
async function remotePrepare(options, planSource) {
  const fs = require('node:fs'), cp = require('node:child_process'), crypto = require('node:crypto');
  const state = JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'})).filter(p=>p.name==='mdv-api');
  if (state.length!==1 || state[0].pm2_env.pm_cwd!=='/var/www/mdv-api' || process.cwd()!=='/var/www/mdv-api') throw Error('Unexpected target');
  const original = fs.readFileSync('.env','utf8'), env = require('dotenv').parse(original), pm = state[0].pm2_env;
  const value = key => pm[key] ?? pm.env?.[key] ?? env[key];
  const otherFlags = Object.fromEntries([...new Set([...Object.keys(env),...Object.keys(pm),...Object.keys(pm.env||{})])].filter(k=>k.startsWith('MDV_PRINT3D_') && k!=='MDV_PRINT3D_FILAMENT_STOCK_ENABLED').map(k=>[k,value(k)]));
  const db = await require('mysql2/promise').createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME});
  try {
    const [columns] = await db.query('SHOW COLUMNS FROM print3d_filament_movements');
    const pending = eval('('+planSource+')')(columns);
    const [[lock]] = await db.query("SELECT GET_LOCK('mdv-filament-release',10) AS acquired");
    if (Number(lock.acquired)!==1) throw Error('Publication lock unavailable');
    const snapshot = async () => {
      const [stock] = await db.query('SELECT * FROM print3d_filament_stock ORDER BY filament_id');
      const [rows] = await db.query('SELECT id,filament_id,movement_key,production_event_id,quantity_delta_grams,reason,actor_id,created_at FROM print3d_filament_movements ORDER BY id');
      return {stock:stock.length,movements:rows.length,sha256:crypto.createHash('sha256').update(JSON.stringify([stock,rows])).digest('hex')};
    };
    const before = await snapshot();
    const result = {pending,before,productionEnabled:value('MDV_PRINT3D_PRODUCTION_ENABLED')==='1',stockEnabled:value('MDV_PRINT3D_FILAMENT_STOCK_ENABLED')==='1',otherFlags};
    if (options.checkOnly) return result;
    if (pending && !options.migrate) throw Error('Migration 054 requires explicit --apply-filament-migration-054');
    if (!result.stockEnabled && !options.enableStock) throw Error('Stock activation requires explicit --enable-filament-stock');
    const backup = '/var/www/mdv-api/backups/print3d-filaments-'+Date.now();
    fs.mkdirSync(backup,{recursive:true,mode:0o700}); fs.chmodSync(backup,0o700);
    fs.writeFileSync(backup+'/.env',original,{flag:'wx',mode:0o600});
    let tool; for(const t of ['mysqldump','mariadb-dump']) {try{cp.execFileSync(t,['--version'],{stdio:'ignore'});tool=t;break;}catch{}}
    if(!tool) throw Error('Database backup tool unavailable');
    const out = fs.openSync(backup+'/database.sql','wx',0o600);
    try { cp.execFileSync(tool,['--single-transaction','--skip-lock-tables','--hex-blob','--no-tablespaces','--host='+env.DB_HOST,'--user='+env.DB_USER,env.DB_NAME,'print3d_filament_movements','print3d_filament_stock'],{env:{...process.env,MYSQL_PWD:env.DB_PASS},stdio:['ignore',out,'pipe']}); }
    catch {throw Error('Database backup failed (details withheld)');} finally{fs.closeSync(out);}
    if(fs.statSync(backup+'/database.sql').size<100) throw Error('Invalid backup');
    const [fresh] = await db.query('SHOW COLUMNS FROM print3d_filament_movements');
    if(eval('('+planSource+')')(fresh)!==pending) throw Error('Schema changed during backup');
    if(pending) await db.query(options.sql);
    const [afterColumns] = await db.query('SHOW COLUMNS FROM print3d_filament_movements');
    if(eval('('+planSource+')')(afterColumns)) throw Error('Migration incomplete');
    const after = await snapshot();
    if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('Inventory changed during migration; do not activate');
    const flag='MDV_PRINT3D_FILAMENT_STOCK_ENABLED';
    const lines=original.split(/\r?\n/); const matches=lines.map((l,i)=>/^MDV_PRINT3D_FILAMENT_STOCK_ENABLED\s*=/.test(l)?i:-1).filter(i=>i>=0);
    if(matches.length>1) throw Error('Duplicate stock flag');
    if(matches.length) lines[matches[0]]=flag+'=1'; else lines.push(flag+'=1');
    const updated=lines.join('\n');
    if(fs.readFileSync('.env','utf8')!==original) throw Error('Environment changed during preflight');
    fs.writeFileSync('.env.filament-release',updated,{mode:0o600}); fs.renameSync('.env.filament-release','.env');
    return {...result,backup,after,previousFlag:value(flag)||'0'};
  } finally { await db.query("SELECT RELEASE_LOCK('mdv-filament-release')").catch(()=>{}); await db.end(); }
}
const quote = value => "'"+String(value).replace(/'/g,"'\\''")+"'";
const command = source => `cd /var/www/mdv-api && node -e ${quote("eval(Buffer.from('"+Buffer.from(source).toString('base64')+"','base64').toString())")}`;
async function deployPrint3dFilaments(options) {
  const {appDir,apiProc,root,exec,read,checkOnly=false,migrate=false,enableStock=false}=options;
  if(appDir!=='/var/www/mdv-api' || apiProc.name!=='mdv-api' || !ENTRIES.some(f=>apiProc.pm2_env.pm_exec_path===appDir+'/'+f)) throw Error('Unexpected target');
  const sources = Object.fromEntries(MODULES.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
  const oldStock = execFileSync('git',['show','983242af:services/print3dMaterialStock.cjs'],{cwd:root,encoding:'utf8'});
  const patchFile = (source,file) => {
    if(ENTRIES.includes(file)) return patchEntry(source);
    const normal = s=>(s||'').replace(/\r\n/g,'\n');
    if(source && normal(source)!==normal(sources[file]) && !(file===MODULES[2] && normal(source)===normal(oldStock))) throw Error('Remote module differs: '+file);
    return sources[file];
  };
  const deployment = {...options,files:[...MODULES,...ENTRIES],backupPrefix:'print3d-filaments-code',patchFile};
  await deployProductReadPrivacy({...deployment,checkOnly:true});
  const sql=fs.readFileSync(path.join(root,'migrations/054_print3d_filament_adjustments.sql'),'utf8');
  const preparation=JSON.parse(await exec(command(`(${remotePrepare.toString()})(${JSON.stringify({checkOnly,migrate,enableStock,sql})},${JSON.stringify(schemaPlan.toString())}).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('Filament database preparation failed; activation stopped');process.exit(1)})`)));
  console.log(JSON.stringify({phase:'filament-preflight',...preparation}));
  if(checkOnly) return preparation;
  const health = () => exec(command(`(${waitForHealth.toString()})().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exit(1)})`));
  try {
    await deployProductReadPrivacy({...deployment,exec:async cmd=>{
      if(cmd==='pm2 restart mdv-api') {const output=await exec(`${FLAG}=1 pm2 restart mdv-api --update-env`);await health();return output;}
      return exec(cmd);
    }});
    // Idempotent re-run may not need a file promotion, but must activate its flag.
    await exec(`${FLAG}=1 pm2 restart mdv-api --update-env`); await health();
    const verified=JSON.parse(await exec(command(`(${remotePrepare.toString()})({checkOnly:true},${JSON.stringify(schemaPlan.toString())}).then(r=>console.log(JSON.stringify(r))).catch(()=>process.exit(1))`)));
    if(verified.pending || !verified.stockEnabled || JSON.stringify(verified.otherFlags)!==JSON.stringify(preparation.otherFlags)) throw Error('Feature/schema verification failed');
    console.log(JSON.stringify({phase:'filament-ready',backup:preparation.backup,stockEnabled:true,productionEnabled:verified.productionEnabled,inventoryUnchanged:JSON.stringify(verified.before)===JSON.stringify(preparation.before)}));
  } catch(error) {
    const previous=/^[01]$/.test(preparation.previousFlag)?preparation.previousFlag:'0';
    await exec(`cp -p ${preparation.backup}/.env /var/www/mdv-api/.env && ${FLAG}=${previous} pm2 restart mdv-api --update-env`);
    throw error;
  }
}
module.exports={patchEntry,schemaPlan,remotePrepare,deployPrint3dFilaments,HOOK,COST};
