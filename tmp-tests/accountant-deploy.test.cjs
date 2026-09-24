const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { files, patchServer, deployAccountantPortal } = require('../scripts/deploy-accountant-portal.cjs');
test('patch de importação é idempotente, preserva o restante do servidor e rejeita divergências', () => {
  const current=fs.readFileSync(path.join(__dirname,'../vps_server.js'),'utf8');
  const previous=current.replace(', includeXml = false','').replace(/^.*getXml: includeXml.*\r?\n/m,'');
  assert.equal(patchServer(previous).replaceAll('\r\n','\n'),current.replaceAll('\r\n','\n'));
  assert.equal(patchServer(current),current);
  assert.throws(()=>patchServer('runtime desconhecido'),/anchor/);
  assert.throws(()=>patchServer(previous+previous),/anchor/);
});
test('deploy limitado ao contador não instala nem ativa emissão', async () => {
  assert(!files.some(file=>/Authorization|Transmission|Signing|companyFiscalServer/.test(file)));
  let called=false;
  await assert.rejects(deployAccountantPortal({appDir:'/wrong',apiProc:{name:'mdv-api'},exec:()=>{called=true;}}),/target/);
  assert.equal(called,false);
  for(const file of files)assert(fs.existsSync(path.join(__dirname,'..',file)));
});
