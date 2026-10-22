'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchStockSync}=require('../scripts/smartphone-moving-average-deploy-core.cjs');
test('surgical stock hook supports current and legacy entrypoints without replacing unrelated runtime',()=>{
  const modern="async function syncProductStock(productId, db = pool) {\n  return syncSerializedProductStockFromUnits(productId, db);\n}";
  const legacy=fs.readFileSync('server.js','utf8');
  const start=legacy.indexOf('async function syncProductStock(productId, db = pool) {'),end=legacy.indexOf('\n}',start)+2;
  const old=legacy.slice(start,end).split('\n').filter(l=>!l.includes('smartphoneMovingAverageServer')).join('\n');
  for(const body of [modern,old]) {
    const original='unrelated before\n'+body+'\nunrelated after';
    const result=patchStockSync(original);
    assert.ok(result.startsWith('unrelated before\n'));assert.ok(result.endsWith('\nunrelated after'));
    assert.match(result,/synchronizeProduct\(pool, productId, db === pool \? null : db\)/);
    assert.equal(patchStockSync(result),result);
  }
  assert.throws(()=>patchStockSync(modern.replace('return syncSerializedProductStockFromUnits(productId, db);','return unreviewed();')),/Unreviewed/);
});
test('publication mode delegates schema backup/init and only the scoped API',()=>{
  const script=fs.readFileSync('deploy-vps-server-only.cjs','utf8');
  assert.match(script,/--moving-average-only[\s\S]*deploy-smartphone-moving-average[\s\S]*return;/);
  const deploy=fs.readFileSync('scripts/deploy-smartphone-moving-average.cjs','utf8');
  assert.ok(deploy.indexOf("['stop','mdv-api']")<deploy.indexOf('mysqldump'));
  assert.ok(deploy.indexOf('mysqldump')<deploy.indexOf('started=true'));
  assert.match(deploy,/Operational rows changed during migration/);
  assert.match(deploy,/protectedTables=\['products','units','sales','sale_items'\]/);
});
