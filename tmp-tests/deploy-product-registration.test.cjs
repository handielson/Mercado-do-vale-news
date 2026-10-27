const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchModule, patchEntry, patchDraftEntry, deployProductDrafts, schemaReady, setRecipeFlag, MODULES } = require('../scripts/deploy-product-registration.cjs');

test('draft update accepts the reviewed installed module, retries safely and rejects remote drift',async()=>{
  const module='services/productFormDraftsServer.cjs';
  const baseline=require('node:child_process').execFileSync('git',['show','v1.2.690-colecoes-whatsapp-dinamicas:'+module],{encoding:'utf8'});
  const updated=fs.readFileSync(module,'utf8');
  for (const source of [baseline,updated,'']) await deployProductDrafts({
    root:process.cwd(),appDir:'/var/www/mdv-api',apiProc:{name:'mdv-api',pm2_env:{pm_exec_path:'/var/www/mdv-api/server.js'}},checkOnly:true,
    read:async remote=>remote.endsWith('/modelParentPrefill.mjs') ? '' : remote.endsWith('/'+module) ? source : fs.readFileSync('vps_server.cjs','utf8'),
    write:async()=>assert.fail('Preflight must not write'),exec:async()=>assert.fail('Preflight must not restart'),
  });
  await assert.rejects(deployProductDrafts({
    root:process.cwd(),appDir:'/var/www/mdv-api',apiProc:{name:'mdv-api',pm2_env:{pm_exec_path:'/var/www/mdv-api/server.js'}},checkOnly:true,
    read:async()=>baseline+'\n// unknown remote change',write:async()=>assert.fail('Drift must not write'),exec:async()=>assert.fail('Drift must not restart'),
  }),/differs/);
});

test('draft publisher adds only its authenticated hook and preserves remote integrations', () => {
  const source = fs.readFileSync('vps_server.cjs','utf8');
  const hook = "require('./services/productFormDraftsServer.cjs').registerProductFormDraftRoutes(fastify, { pool, requireAdminBearerToken });\n";
  const before = source.replace(/\r\n/g,'\n').replace(hook,'');
  assert.equal(patchDraftEntry(before), source.replace(/\r\n/g,'\n'));
  assert.equal(patchDraftEntry(patchDraftEntry(before)), patchDraftEntry(before));
  const crlf = before.replace(/\n/g,'\r\n');
  assert.equal(patchDraftEntry(crlf), patchDraftEntry(before).replace(/\n/g,'\r\n'));
  assert.throws(() => patchDraftEntry('unknown entry'), /anchor/);
  assert.throws(() => patchDraftEntry(before + '\nregisterProductFormDraftRoutes'), /differs/);
  const deploy = fs.readFileSync('scripts/deploy-product-registration.cjs','utf8');
  const drafts = deploy.slice(deploy.indexOf('async function deployProductDrafts('),deploy.indexOf('async function deployProductRegistration('));
  assert.match(drafts,/files:\[module,shared,\.\.\.ENTRIES\]/);
  assert.match(drafts,/services\/modelParentPrefill.mjs/);
  assert.doesNotMatch(drafts,/activate|setRecipeFlag|migration|uploadPrivate/);
});
test('registration publisher rejects unknown drift; accepts only reviewed baseline or its release', () => {
  assert.equal(patchModule('old\r\n', 'new\n', 'old\n'), 'new\n');
  assert.equal(patchModule('new\n', 'new\n', 'old\n'), 'new\n');
  assert.throws(() => patchModule('unknown', 'new', 'old'), /differs/);
  assert.throws(() => patchModule('', 'new', 'old'), /Missing/);
  assert.equal(patchModule('', 'new', ''), 'new');
  assert(!MODULES.some(p => /Payments|Checkout|Filament|Shipping|shopee/.test(p)));
});
test('entry patch preserves existing integrations and is idempotent in both API entrypoints', () => {
  // All three deployed entries use this reviewed baseline helper. The legacy
  // local .js does not; the publisher deliberately patches remote sources.
  for (const source of [require('node:child_process').execFileSync('git',['show','7555d8eb:vps_server.cjs'],{encoding:'utf8',maxBuffer:8*1024*1024}), fs.readFileSync('vps_server.cjs','utf8')]) {
    const patched = patchEntry(source);
    assert.match(patched, /AS parent_images/);
    assert.equal(patchEntry(patched), patched);
    assert.equal((patched.match(/registerPrint3dRecipeRoutes/g)||[]).length, 1);
    assert.equal((patched.match(/registerPrint3dRecipeFileRoutes/g)||[]).length, 1);
    assert.equal((patched.match(/registerPrint3dActiveRecipeRoutes/g)||[]).length, 1);
    assert(patched.includes('uploadPrivate:'));
  }
  assert.throws(() => patchEntry('unknown entry'), /batch/);
});
test('activation only changes recipe flag, rejecting duplicates and incomplete schema', () => {
  const original = 'SECRET=untouched\nMDV_PRINT3D_PRODUCTION_ENABLED=0\nMDV_PRINT3D_SHIPPING_ENABLED=1\n';
  assert.equal(setRecipeFlag(original), original+'MDV_PRINT3D_RECIPES_ENABLED=1');
  assert.equal(setRecipeFlag(setRecipeFlag(original)), setRecipeFlag(original));
  assert.throws(() => setRecipeFlag('MDV_PRINT3D_RECIPES_ENABLED=0\nMDV_PRINT3D_RECIPES_ENABLED=1'), /Duplicate/);
  assert.throws(() => schemaReady({}), /Missing/);
});
