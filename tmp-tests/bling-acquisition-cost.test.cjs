const { test } = require('node:test');
const assert = require('node:assert/strict');
const { acquisitionCost, importCosts } = require('../services/blingAcquisitionCost.cjs');
const base = () => ({schema:'mdv.bling.acquisition.v1', complete:true, sku:'TEST', blingId:'1', deposit:'Loja', sourceUrl:'https://www.bling.com.br/estoque.php?buscaid=1#/', observedAt:'2026-10-02T09:00:00Z', currentQuantityMilli:1000, movements:[{id:'balance', at:'2026-09-04T19:00:00Z',kind:'balance', quantityMilli:1000, purchaseCents:500, costCents:700}]});
test('custo inclui despesas e não usa preço de compra', () => assert.equal(acquisitionCost(base()).costCents,700));
test('média é ponderada por entradas desde o último balanço; saídas não são aquisições', () => {
  const h=base();h.movements.unshift({id:'old',at:'2026-01-01T00:00:00Z',kind:'balance',quantityMilli:100000,costCents:99999});
  h.movements.push({id:'entry',at:'2026-09-05T00:00:00Z',kind:'entry',quantityMilli:2000,costCents:1000},{id:'sale',at:'2026-09-06T00:00:00Z',kind:'exit',quantityMilli:1000});h.currentQuantityMilli=2000;
  assert.equal(acquisitionCost(h).costCents,900);
});
test('custo permanece conhecido depois de saída total', () => {const h=base();h.movements.push({id:'sale',at:'2026-09-05T00:00:00Z',kind:'exit',quantityMilli:1000});h.currentQuantityMilli=0;assert.equal(acquisitionCost(h).costCents,700);});
test('histórico parcial, custo ausente, duplicação e divergência bloqueiam', () => {
  for(const change of [h=>h.complete=false,h=>h.movements[0].costCents=null,h=>h.movements.push(h.movements[0]),h=>h.currentQuantityMilli=2000,h=>h.movements[0].kind='transfer',h=>h.movements[0].costCents=0,h=>h.movements[0].at='2027-01-01T00:00:00Z']) {const h=base();change(h);assert.throws(()=>acquisitionCost(h));}
});
test('importação altera somente custo e evidência; prévia não grava', async () => {
  const h=base();h.productId='local';h.expectedCostCents=null;let committed=0,rolledBack=0;const writes=[];
  const db={beginTransaction:async()=>{},commit:async()=>committed++,rollback:async()=>rolledBack++,query:async(sql,args)=>{
    if(sql.startsWith('SELECT'))return [[{id:'local',sku:'TEST',bling_id:1,is_parent:0,stock_quantity:1,price_cost:null,specs:{color:'cyan'}}]];
    writes.push({sql,args});return [{affectedRows:1}];
  }};
  await importCosts(db,[h]);assert.equal(writes.length,0);assert.equal(rolledBack,1);
  let saved=false;await importCosts(db,[h],{apply:true,saveReceipt:async()=>{saved=true;assert.equal(writes.length,0);}});
  assert.equal(saved,true);assert.equal(committed,1);assert.equal(writes.length,1);assert.equal(writes[0].args[0],700);
  assert.doesNotMatch(writes[0].sql,/stock_quantity=|price_retail=|price_wholesale=/);
  assert.match(writes[0].sql,/JSON_SET/);
});
test('identidade e mudanças concorrentes abortam o lote inteiro',async()=>{
  for(const change of [p=>p.bling_id=2,p=>p.stock_quantity=2,p=>p.price_cost=500,p=>p.is_parent=1]) {
    const h=base();h.productId='local';h.expectedCostCents=null;let writes=0,rollback=0;
    const p={id:'local',sku:'TEST',bling_id:1,is_parent:0,stock_quantity:1,price_cost:null,specs:{}};change(p);
    const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>rollback++,query:async sql=>{if(sql.startsWith('SELECT'))return [[p]];writes++;return [{}];}};
    await assert.rejects(importCosts(db,[h],{apply:true}));assert.equal(writes,0);assert.equal(rollback,1);
  }
});
test('webhooks não substituem custo de aquisição por compra, fornecedor ou pai',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  for(const file of ['vps_server.js','vps_server.cjs']) {
    const source=fs.readFileSync(file,'utf8');const fn=source.match(/function readBlingCostPriceForWebhookVps\([^]*?\n}/)[0];
    const read=vm.runInNewContext('('+fn+')');
    assert.equal(read({precoCompra:5,precoCusto:0,fornecedor:{precoCusto:10}},{precoCusto:7}),null);
  }
  const frontend=fs.readFileSync('services/blingService.ts','utf8');
  assert.doesNotMatch(frontend,/precoCusto:\s*data\.precoCusto|price_cost:\s*item\.precoCusto|updateData\.price_cost\s*=/);
});
test('deploy de custo preserva outras rotas e recusa produção divergente',()=>{
  const {patch}=require('../scripts/deploy-bling-acquisition-cost.cjs');
  const before="function readBlingCostPriceForWebhookVps(productData, detail) {\n  return productData.precoCompra;\n}\n      if (accessToken && blingId && (!resolvedName || !resolvedSku || readBlingCostPriceForWebhookVps(productData, null) === null)) {";
  const after="function readBlingCostPriceForWebhookVps(productData, detail) {\n  return null;\n}\n      if (accessToken && blingId && (!resolvedName || !resolvedSku)) {";
  const remote=before+'\nOUTRA ROTA PRODUÇÃO';const result=patch(remote,before,after);assert.equal(result,after+'\nOUTRA ROTA PRODUÇÃO');assert.equal(patch(result,before,after),result);
  assert.throws(()=>patch(remote.replace('return productData.precoCompra','return changed'),before,after),/diverge/);
});
