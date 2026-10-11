'use strict';
// Reuses the atomic selective publisher; never copies the monolithic API entry.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const { patchEntry: patchSku } = require('./deploy-product-auto-sku.cjs');
const { waitForHealth } = require('./deploy-print3d.cjs');
const BASELINE = '7555d8eb324f4e3b6893ef488096c1be34b9fc27';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULES = ['services/productSku.cjs', 'services/smartphoneModelSpecs.mjs',
  'services/productReadPrivacy.cjs',
  'services/productStorefrontOffer.cjs', 'services/productStorefrontOffersServer.cjs',
  'services/print3dRecipesServer.cjs', 'services/print3dRecipeFilesServer.cjs',
  'services/print3dActiveRecipeServer.cjs', 'services/print3dProduction.cjs',
  'utils/print3dRecipeDraft.mjs', 'utils/print3dPlatePlan.mjs'];
const FLAG = 'MDV_PRINT3D_RECIPES_ENABLED';
const normal = source => source.replace(/\r\n/g, '\n');
function patchModule(source, updated, baseline) {
  if (!source && baseline) throw Error('Missing existing module');
  if (source && ![updated, baseline].some(value => normal(value) === normal(source))) throw Error('Remote module differs');
  return updated;
}
function patchEntry(source) {
  let value = normal(patchSku(source));
  for (const hook of ['registerPrint3dRecipeRoutes', 'registerPrint3dRecipeFileRoutes', 'registerPrint3dActiveRecipeRoutes']) {
    if (value.split(hook).length !== 2) throw Error('Missing/duplicate recipe hook: '+hook);
  }
  if (!value.includes('uploadPrivate:') || !value.includes('downloadPrivate:')) throw Error('Private NAS adapters missing');
  const old = `function productFamilyNameSelectSql(productAlias = 'products') {
  return \`(SELECT family_parent.name FROM products family_parent
    WHERE family_parent.id COLLATE utf8mb4_unicode_ci = \${productAlias}.parent_id COLLATE utf8mb4_unicode_ci
    LIMIT 1) AS parent_name,`;
  const updated = `function productFamilyNameSelectSql(productAlias = 'products', compact = false) {
  return \`(SELECT family_parent.name FROM products family_parent
    WHERE family_parent.id COLLATE utf8mb4_unicode_ci = \${productAlias}.parent_id COLLATE utf8mb4_unicode_ci
    LIMIT 1) AS parent_name,
    (SELECT \${compact ? "CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(family_parent.images, '$[0]')) LIKE 'http%' THEN JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(family_parent.images, '$[0]'))) ELSE JSON_ARRAY() END" : 'family_parent.images'} FROM products family_parent
     WHERE family_parent.id COLLATE utf8mb4_unicode_ci = \${productAlias}.parent_id COLLATE utf8mb4_unicode_ci
     LIMIT 1) AS parent_images,
    (SELECT \${compact ? 'NULL' : 'family_parent.description'} FROM products family_parent
     WHERE family_parent.id COLLATE utf8mb4_unicode_ci = \${productAlias}.parent_id COLLATE utf8mb4_unicode_ci
     LIMIT 1) AS parent_description,`;
  if (!value.includes(updated)) {
    if (value.split(old).length !== 2) throw Error('Unexpected family image helper');
    value = value.replace(old, updated);
  }
  const start = value.indexOf('  const cols = compact');
  const end = value.indexOf('  let sql = `SELECT ${cols}', start);
  if (start < 0 || end < 0) throw Error('Missing compact product projection');
  const projection = value.slice(start, end);
  const call = "${productFamilyNameSelectSql('products')}";
  const compactCall = "${productFamilyNameSelectSql('products', true)}";
  if (!projection.includes(compactCall)) {
    if (projection.split(call).length !== 3) throw Error('Unexpected compact family image call');
    value = value.slice(0,start) + projection.replace(call, compactCall) + value.slice(end);
  }
  return source.includes('\r\n') ? value.replace(/\n/g, '\r\n') : value;
}
function setRecipeFlag(original) {
  const lines = original.split(/\r?\n/);
  const matches = lines.map((line, index) => /^MDV_PRINT3D_RECIPES_ENABLED\s*=/.test(line) ? index : -1).filter(i => i >= 0);
  if (matches.length > 1) throw Error('Duplicate recipe flag');
  if (matches.length) lines[matches[0]] = 'MDV_PRINT3D_RECIPES_ENABLED=1';
  else if (lines[lines.length-1] === '') lines[lines.length-1] = 'MDV_PRINT3D_RECIPES_ENABLED=1';
  else lines.push('MDV_PRINT3D_RECIPES_ENABLED=1');
  return lines.join('\n');
}
function schemaReady(schema) {
  const required = {
    print3d_recipe_revisions:['id','product_id','sku_snapshot','revision','draft_json','draft_sha256','created_by','created_at'],
    print3d_recipe_files:['id','asset_id','recipe_id','kind','printer_profile','original_name','storage_name','synology_path','byte_size','sha256','created_by','created_at'],
    print3d_file_assets:['id','sha256','storage_name','synology_path','byte_size','created_by','created_at'],
    print3d_active_recipes:['product_id','recipe_id','primary_file_id','selected_by','selected_at'],
  };
  for (const [table, fields] of Object.entries(required)) {
    if (!fields.every(field => schema[table]?.includes(field))) throw Error('Missing recipe schema: '+table+'; no automatic migration');
  }
  return true;
}
// Self-contained read-only preflight/flag activation executed on the selected VPS.
async function remoteRecipeState({ activate = false }, schemaSource, flagSource) {
  const fs = require('node:fs'), cp = require('node:child_process'), crypto = require('node:crypto');
  const apps = JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'})).filter(p=>p.name==='mdv-api');
  if (apps.length!==1 || apps[0].pm2_env.pm_cwd!=='/var/www/mdv-api' || process.cwd()!=='/var/www/mdv-api') throw Error('Unexpected target');
  const original = fs.readFileSync('.env','utf8'), env = require('dotenv').parse(original), pm = apps[0].pm2_env;
  const val = key => pm[key] ?? pm.env?.[key] ?? env[key];
  const otherFlags = Object.fromEntries([...new Set([...Object.keys(env),...Object.keys(pm),...Object.keys(pm.env||{})])].filter(k=>k.startsWith('MDV_PRINT3D_')&&k!=='MDV_PRINT3D_RECIPES_ENABLED').sort().map(k=>[k,val(k)]));
  const root = val('MDV_PRINT3D_SYNOLOGY_FOLDER');
  if (!require('./services/print3dRecipeFilesServer.cjs').isPrivatePrint3dRoot(root)) throw Error('Private production root is invalid');
  const db = await require('mysql2/promise').createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME});
  try {
    const schema = {}, counts = {};
    for (const table of ['print3d_recipe_revisions','print3d_recipe_files','print3d_file_assets','print3d_active_recipes']) {
      const [columns] = await db.query('SHOW COLUMNS FROM '+table); schema[table] = columns.map(c=>c.Field);
      const [[count]] = await db.query('SELECT COUNT(*) AS total FROM '+table); counts[table] = Number(count.total);
    }
    eval('('+schemaSource+')')(schema);
    const result = {schemaReady:true,privateRootValid:true,recipeEnabled:val('MDV_PRINT3D_RECIPES_ENABLED')==='1',otherFlags,counts};
    if (!activate) return result;
    const backup = '/var/www/mdv-api/backups/product-registration-env-'+Date.now();
    fs.mkdirSync(backup,{mode:0o700}); fs.writeFileSync(backup+'/.env',original,{flag:'wx',mode:0o600});
    // No schema/data mutation. The hash records the exact prior configuration.
    const previousFlag = val('MDV_PRINT3D_RECIPES_ENABLED') || '0';
    const updated = eval('('+flagSource+')')(original);
    if (fs.readFileSync('.env','utf8')!==original) throw Error('Environment changed during preflight');
    fs.writeFileSync('.env.registration-release',updated,{flag:'wx',mode:0o600}); fs.renameSync('.env.registration-release','.env');
    return {...result,backup,previousFlag,configurationHash:crypto.createHash('sha256').update(original).digest('hex')};
  } finally { await db.end(); }
}
const quote = value => "'"+String(value).replace(/'/g,"'\\''")+"'";
const command = source => `cd /var/www/mdv-api && node -e ${quote("eval(Buffer.from('"+Buffer.from(source).toString('base64')+"','base64').toString())")}`;
function patchDraftEntry(source) {
  let value = normal(source);
  const hook = "require('./services/productFormDraftsServer.cjs').registerProductFormDraftRoutes(fastify, { pool, requireAdminBearerToken });";
  const anchor = "require('./services/print3dMaterialsServer.cjs').registerPrint3dMaterialRoutes(fastify, { pool, requireAdminBearerToken });";
  if (value.includes('registerProductFormDraftRoutes')) {
    if (value.split(hook).length !== 2 || value.split('registerProductFormDraftRoutes').length !== 2) throw Error('Draft hook differs');
  } else {
    if (value.split(anchor).length !== 2) throw Error('Missing/ambiguous draft anchor');
    value = value.replace(anchor,anchor+'\n'+hook);
  }
  return source.includes('\r\n') ? value.replace(/\n/g,'\r\n') : value;
}
async function deployProductDrafts(options) {
  const module = 'services/productFormDraftsServer.cjs';
  const updated = fs.readFileSync(path.join(options.root,module),'utf8');
  await deployProductReadPrivacy({...options,files:[module,...ENTRIES],backupPrefix:'product-form-drafts',patchFile(source,file) {
    return file === module ? patchModule(source,updated,'') : patchDraftEntry(source);
  },exec:async cmd => {
    const out = await options.exec(cmd);
    if (cmd === 'pm2 restart mdv-api') await options.exec(command(`(${waitForHealth.toString()})().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exit(1)})`));
    return out;
  }});
}
async function deployProductRegistration(options) {
  const { root, exec, checkOnly = false, enableRecipes = false } = options;
  if (!checkOnly && !enableRecipes) throw Error('Explicit --enable-print3d-recipes required');
  const updated = Object.fromEntries(MODULES.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
  const baseline = Object.fromEntries(MODULES.map(f=>[f,f==='utils/print3dPlatePlan.mjs'?'':execFileSync('git',['show',BASELINE+':'+f],{cwd:root,encoding:'utf8'})]));
  const deployment = {...options,files:[...MODULES,...ENTRIES],backupPrefix:'product-registration-code',patchFile(source,file) {
    if (ENTRIES.includes(file)) return patchEntry(source);
    try { return patchModule(source,updated[file],baseline[file]); } catch (error) { throw Error(error.message+': '+file); }
  }};
  await deployProductReadPrivacy({...deployment,checkOnly:true});
  const state = activate => exec(command(`(${remoteRecipeState.toString()})(${JSON.stringify({activate})},${JSON.stringify(schemaReady.toString())},${JSON.stringify(setRecipeFlag.toString())}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exit(1)})`)).then(JSON.parse);
  const before = await state(false); console.log(JSON.stringify({phase:'registration-preflight',...before}));
  if (checkOnly) return before;
  const health = () => exec(command(`(${waitForHealth.toString()})().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exit(1)})`));
  let activation;
  try {
    await deployProductReadPrivacy({...deployment,exec:async cmd=>{const out=await exec(cmd);if(cmd==='pm2 restart mdv-api') await health();return out;}});
    activation = await state(true);
    await exec(`${FLAG}=1 pm2 restart mdv-api --update-env`); await health();
    const after = await state(false);
    if (!after.recipeEnabled || JSON.stringify(after.otherFlags)!==JSON.stringify(before.otherFlags)) throw Error('Feature verification failed');
    console.log(JSON.stringify({phase:'registration-ready',...after,configurationBackup:activation.backup,dataUnchanged:JSON.stringify(before.counts)===JSON.stringify(after.counts)}));
  } catch (error) {
    if (activation) {
      const previous = /^[01]$/.test(activation.previousFlag) ? activation.previousFlag : '0';
      await exec(`cp -p ${activation.backup}/.env /var/www/mdv-api/.env && ${FLAG}=${previous} pm2 restart mdv-api --update-env`); await health();
    }
    throw error;
  }
}
module.exports = {patchModule,patchEntry,patchDraftEntry,deployProductDrafts,schemaReady,setRecipeFlag,remoteRecipeState,deployProductRegistration,MODULES};
