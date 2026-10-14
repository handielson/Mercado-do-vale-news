const test=require('node:test');const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const {patch}=require('../scripts/deploy-print3d-domain.cjs');
const {patchApiCors}=require('../scripts/install-print3d-site-nginx.cjs');
test('domain deployment changes only canonical origins and sitemap detection; rejects drift',()=>{
 for(const file of ['vps_server.js','vps_server.cjs']){
  const before=execFileSync('git',['show','f2ea69e9:'+file],{encoding:'utf8',maxBuffer:10*1024*1024});
  const after=patch(before);assert.equal(patch(after),after);assert.doesNotMatch(after,/3dmv\.com\.br|3dmv\\\.com\\\.br/);
  assert.ok(after.includes("'https://www.gcode3d.com.br'"));
  assert.equal(after.split('registerUnitJournalRoutes').length,before.split('registerUnitJournalRoutes').length);
 }
 assert.throws(()=>patch('unknown runtime'),/anchor drift/);
});
test('nginx CORS changes only the retired origin and rejects incomplete configuration',()=>{
 const before=execFileSync('git',['show','f2ea69e9:infra/nginx/mdv-api-ssl.conf'],{encoding:'utf8'});
 const after=patchApiCors(before);
 assert.equal(patchApiCors(after),after);
 assert.equal(after.replaceAll('gcode3d\\.com\\.br','3dmv\\.com\\.br'),before);
 assert.throws(()=>patchApiCors('server unknown {}'),/drift/);
});
