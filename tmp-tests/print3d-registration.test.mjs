import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto, createHash } from 'node:crypto';
import { buildPrint3dRecipeDraft } from '../utils/print3dRecipeDraft.mjs';
import { calculatePrint3dCost } from '../utils/print3dCost.mjs';
import { saveFamilyRegistration } from '../components/products/familyRegistration.js';

function service() {
  const exports = {}, saved = [], uploads = [];
  const compiled = ts.transpileModule(fs.readFileSync('services/print3dRegistration.ts','utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, File, crypto:webcrypto, Map, TextEncoder,
    require:name => {
      if (name.includes('print3dCost.mjs')) return { calculatePrint3dCost };
      if (name.includes('print3dRecipeDraft.mjs')) return { buildPrint3dRecipeDraft };
      if (name.endsWith('print3dRecipes')) return { print3dRecipesService:{ status:async () => ({ enabled:true, platePlans:true }), save:async draft => { saved.push(draft); return { id:'revision-id', sha256:createHash('sha256').update(JSON.stringify(draft)).digest('hex') }; } } };
      if (name.endsWith('print3dRecipeFiles')) return { print3dRecipeFilesService:{ status:async () => ({ enabled:true }), upload:async (...args) => { uploads.push(args); }, download:async () => { throw new Error('Unexpected download'); } } };
      throw new Error(name);
    },
  });
  return { ...exports, saved, uploads };
}
const setup = () => ({ revision:'r1', sourceUrl:'https://makerworld.com/pt/models/1841715', printer:'A1', profile:'A1 PETG', includesWaste:true, notes:'Montar as partes', pieces:10, laborMinutes:0,
  settings:{ printerWatts:100, energyCentsPerKwh:100, machineCentsPerHour:100, laborCentsPerHour:2000, packagingCentsPerPiece:30, taxPercent:0,
    filaments:[{ id:'petg', name:'PETG', color:'Branco', spoolGrams:1000, spoolCostCents:10000 }], supplies:[] }, supplies:[],
  plates:[10,20,30].map((grams,i) => ({ id:`plate-${i+1}`, name:`Placa ${i+1}`, hours:i+1, minutes:0, notes:'', filaments:[{ id:'petg', grams }], files:[{ kind:'model', file:new File([`solid plate ${i}`],`plate-${i+1}.stl`) }] })),
});
const product = { id:'11111111-1111-4111-8111-111111111111', name:'Mini Branco - MINI0001-02', sku:'MINI0001-02' };
test('cópia do pai é independente e seu custo por produto não altera o preço de venda', () => {
  const api = service(), parent = setup();
  const child = api.copyPrint3dSetup(parent), sibling = api.copyPrint3dSetup(parent);
  assert.notEqual(child.revision,parent.revision); assert.notEqual(child.plates[0].id,parent.plates[0].id);
  assert.equal(child.plates[0].files[0].file,parent.plates[0].files[0].file);
  child.plates[0].filaments[0].grams = 100;
  child.settings.filaments[0].spoolCostCents = 20000;
  assert.equal(parent.plates[0].filaments[0].grams,10); assert.equal(sibling.settings.filaments[0].spoolCostCents,10000);
  const priced = api.withPrint3dCost({ price_cost:9999, price_retail:2500, price_reseller:2000, custom_fields:{ inherit_parent_cost:true } }, parent);
  assert.equal(priced.price_cost,156); assert.equal(priced.price_retail,2500); assert.equal(priced.price_reseller,2000);
  assert.equal(priced.custom_fields.inherit_parent_cost,false);
  const incomplete = setup(); incomplete.pieces = 0;
  assert.throws(() => api.withPrint3dCost({price_cost:10},incomplete),/maior que zero/);
});
test('salva revisão canônica com SKU definitivo e envia cada arquivo para a sua placa privada', async () => {
  const api = service();
  await api.savePrint3dRegistration(setup(), product);
  const draft = api.saved[0];
  assert.equal(draft.sku, product.sku); assert.equal(draft.productName, product.name);
  assert.equal(draft.plates.length,3); assert.equal(draft.piecesPerBatch,10);
  assert.equal(draft.costSnapshot.batchCents,1560); assert.equal(draft.costSnapshot.unitCents,156);
  assert.equal(draft.plates[0].files[0].original_name,'plate-1.stl');
  assert.match(draft.plates[0].files[0].sha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(api.uploads.map(args => args[4]), ['plate-1','plate-2','plate-3']);
  assert.equal(api.uploads.every(args => args[0] === 'revision-id'),true);
  assert.equal(draft.sourceUrl,'https://makerworld.com/pt/models/1841715');
});
test('dados inválidos ou arquivo vazio não disparam a gravação da ficha', async () => {
  const api = service();
  const invalid = setup(); invalid.plates[1].minutes = 60;
  await assert.rejects(api.savePrint3dRegistration(invalid, product),/minutos/);
  const missing = setup(); missing.plates[0].files[0].file = new File([], 'empty.stl');
  await assert.rejects(api.savePrint3dRegistration(missing, product),/vazio/);
  assert.equal(api.saved.length,0); assert.equal(api.uploads.length,0);
});
test('família valida produção antes de criar produtos; retry usa filho confirmado e não troca SKU', async () => {
  const checkpoint = { parent:null, children:{} }, calls = [], created = [];
  let fail = true;
  const api = { validateProduction:async row => { calls.push(`validate:${row.key}`); },
    create:async data => { created.push(data); return { ...data, id:data.parent_id ? product.id : 'parent-id', sku:data.parent_id ? product.sku : 'MINI0001' }; },
    update:async (id,data) => ({ ...data, id }),
    saveProduction:async (row, confirmed) => { calls.push(`production:${confirmed.sku}`); if (fail) throw new Error('offline'); },
  };
  const rows = [{ key:'white', data:{ name:'Branco', sku:'' }, inheritImages:false }];
  await assert.rejects(saveFamilyRegistration({ name:'Mini', sku:'' }, rows, checkpoint, api),/offline/);
  fail = false;
  await saveFamilyRegistration({ name:'Mini', sku:'' }, rows, checkpoint, api);
  assert.equal(created.length,2); assert.equal(checkpoint.children.white.sku,product.sku);
  assert.equal(calls[0],'validate:white');
  assert.deepEqual(calls.filter(c => c.startsWith('production:')), [`production:${product.sku}`,`production:${product.sku}`]);
  api.validateProduction = async () => { throw new Error('invalid params'); };
  await assert.rejects(saveFamilyRegistration({ name:'Other' }, rows, { parent:null, children:{} }, api), /invalid params/);
  assert.equal(created.length,2);
});
test('tarifas do cadastro usam CurrencyInput e permanecem em centavos inteiros', () => {
  const source = fs.readFileSync('components/products/Print3dRegistrationEditor.tsx','utf8');
  assert.match(source, /<CurrencyInput key=\{key\}/);
  assert.match(source, /value=\{value.settings\[key\]\}/);
  assert(!source.includes("numeric(['Energia"));
});
