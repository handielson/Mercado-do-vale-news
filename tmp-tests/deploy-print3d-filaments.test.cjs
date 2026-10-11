const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs');
const {patchEntry,patchModule,schemaPlan,HOOK,COST,remotePrepare}=require('../scripts/deploy-print3d-filaments.cjs');
test('module update accepts reviewed deployed baseline, is idempotent and rejects unknown drift',()=>{
  const file='services/print3dFilaments.cjs',old='// reviewed\n',next='// gradient\n';
  assert.equal(patchModule(old,file,next,old),next);
  assert.equal(patchModule(old.replace(/\n/g,'\r\n'),file,next,old),next);
  assert.equal(patchModule(next,file,next,old),next);
  assert.equal(patchModule('',file,next,old),next);
  assert.throws(()=>patchModule(old+'// remote change\n',file,next,old),/Remote module differs/);
  assert.throws(()=>patchModule('// legacy stock\n',file,next,old,'// legacy stock\n'),/Remote module differs/);
  assert.equal(patchModule('// legacy stock\n','services/print3dMaterialStock.cjs',next,old,'// legacy stock\n'),next);
});
test('selective deployment preserves remote drift and is idempotent',()=>{
  const source="// unrelated remote custom code\nfastify.get('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {\n});\nfastify.patch('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {\n  const valueJson = normalizeAdminPreferenceValue(req.body?.value);\n});\n";
  const result=patchEntry(source); assert.equal(patchEntry(result),result);
  assert.equal(result.replace(HOOK,'').replace(COST,''),source);
  assert.match(result,/MDV_PRINT3D_FILAMENT_STOCK_ENABLED/); assert.doesNotMatch(result,/MDV_PRINT3D_PRODUCTION_ENABLED/);
  assert.throws(()=>patchEntry(source+source)); assert.throws(()=>patchEntry('// filamentCatalogRoutes\n'+source));
  const crlf=source.replace(/\n/g,'\r\n'); assert.equal(patchEntry(patchEntry(crlf)),patchEntry(crlf));
});
test('migration accepts only the known old schema or complete additive result',()=>{
  const old=[{Field:'reason',Type:"enum('receipt','production')",Null:'NO'}];
  const complete=[{Field:'reason',Type:"enum('receipt','production','adjustment')",Null:'NO'},{Field:'note',Type:'varchar(500)',Null:'YES'}];
  assert.equal(schemaPlan(old),true); assert.equal(schemaPlan(complete),false);
  assert.throws(()=>schemaPlan([...old,complete[1]])); assert.throws(()=>schemaPlan([]));
});
test('backup and checksum precede DDL, activation is separately authorized, no business data mutation',()=>{
  const source=remotePrepare.toString();
  assert.ok(source.indexOf('database.sql')<source.indexOf('await db.query(options.sql)'));
  assert.match(source,/if \(pending && !options.migrate\)/); assert.match(source,/!options.enableStock/);
  assert.match(source,/JSON.stringify\(before\)!==JSON.stringify\(after\)/);
  assert.doesNotMatch(source,/DELETE FROM|UPDATE print3d|INSERT INTO print3d/);
  assert.match(fs.readFileSync(new URL('../vps_server.cjs',`file://${__filename.replace(/\\/g,'/')}`),'utf8'),/stockEnabled:process.env.MDV_PRINT3D_FILAMENT_STOCK_ENABLED/);
});
