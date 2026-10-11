import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { FILAMENT_PURCHASE_CHANNELS, filamentPurchaseNote } from '../utils/print3dPurchaseChannel.mjs';
import { groupFilamentStock, filamentEntryDate } from '../utils/print3dFilamentInventory.mjs';
const { applyStock } = createRequire(import.meta.url)('../services/print3dFilaments.cjs');
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('canal da compra é opcional, seletivo e preservado na referência do movimento', () => {
  assert.ok(FILAMENT_PURCHASE_CHANNELS.includes('Shopee'));
  assert.ok(FILAMENT_PURCHASE_CHANNELS.includes('Outro'));
  const receipt = {reason:'receipt',note:'Pedido 123'};
  assert.equal(filamentPurchaseNote(receipt),'Pedido 123');
  assert.equal(filamentPurchaseNote(receipt,'Shopee'),'Canal de compra: Shopee | Referência: Pedido 123');
  assert.equal(filamentPurchaseNote({reason:'receipt',note:''},'Mercado Livre'),'Canal de compra: Mercado Livre');
  assert.equal(filamentPurchaseNote(receipt,'Outro',' Minha loja '),'Canal de compra: Minha loja | Referência: Pedido 123');
  assert.equal(filamentPurchaseNote({...receipt,reason:'adjustment'},'Shopee'),'Pedido 123');
  assert.throws(() => filamentPurchaseNote(receipt,'Desconhecido'));
  for (const custom of ['', 'a'.repeat(81), 'Loja\nA']) assert.throws(() => filamentPurchaseNote(receipt,'Outro',custom));
  assert.throws(() => filamentPurchaseNote({reason:'receipt',note:'a'.repeat(490)},'Shopee'), /500 caracteres/);
  const ui = read('components/print3d/FilamentCatalog.tsx');
  assert.match(ui,/Canal de compra \(opcional\)/);
  assert.match(ui,/movementAction === 'receipt'/);
  assert.match(ui,/FILAMENT_PURCHASE_CHANNELS.map/);
  assert.match(ui,/filamentPurchaseNote\(\{\.\.\.movement,reason:'receipt'/);
  assert.match(ui,/setPurchaseChannel\(''\); setOtherPurchaseChannel\(''\)/);
});

test('filamentos têm página e menu próprios, protegidos por sessão administrativa', () => {
  const routes = read('routes/index.tsx');
  assert.match(routes, /path: "\/admin\/loja-3d\/filamentos",\s*element: <ProtectedRoute requireAdmin=\{true\}><AdminLayout><Print3dFilamentsPage/);
  assert.match(read('layouts/AdminLayout.tsx'), /to: '\/admin\/loja-3d\/filamentos'.*label: 'Filamentos e estoque'/);
  const page = read('pages/admin/products/Print3dFilamentsPage.tsx');
  assert.match(page, /<h1[^>]*>Filamentos e estoque/);
  assert.match(page, /<FilamentCatalog \/>/);
  assert.doesNotMatch(page, /QuickCostSimulator|print3dFilamentsService|print3dCostSettingsService/);
});

test('entrada junto ao cadastro aceita múltiplos kg e converte ao ledger canônico sem duplicar', () => {
  const ui = read('components/print3d/FilamentCatalog.tsx');
  assert.match(ui, /Adicionar estoque em kg/);
  assert.match(ui, /Quantidade desta entrada \(kg\)/);
  assert.match(ui, /save\(editing, catalog.version, receipt\)/);
  assert.match(ui, /Salvar filamento e entrada/);
  assert.doesNotMatch(ui, /Depois de salvar o filamento|wasNew.*openReceipt/);
  assert.ok(ui.indexOf('Quantidade desta entrada (kg)') < ui.indexOf('save(editing, catalog.version, receipt)'));
  assert.match(ui, /value=\{movement.quantity_grams \/ 1000\}/);
  assert.match(ui, /quantity_grams:1000, expected_grams:currentStock/);
  assert.match(ui, /min = 0/);
  assert.doesNotMatch(ui, /step="0\.000001"/);
  assert.doesNotMatch(ui, /max="1"/);
  assert.ok(ui.indexOf('{movement && <fieldset') < ui.indexOf('Buscar por marca, material ou cor<input'));
  const expression = ui.match(/quantity_grams:(Math\.round\(Number\(value\).*?)\}/)[1];
  const convert = new Function('value', `return ${expression}`);
  for (const [kg, g] of [[2,2000],[2.5,2500],[5,5000],[0.5,500],[0.000001,0.001],[-0.25,-250]]) {
    const amount = convert(String(kg));
    assert.equal(amount,g);
    const body = {filament_id:'petg-black',quantity_grams:amount,expected_grams:1000,
      idempotency_key:'ae27a220-f718-480b-99c6-df72f0518a97',reason:kg < 0 ? 'adjustment' : 'receipt',note:'Entrada em kg'};
    const result = applyStock(1000,[],body);
    assert.equal(result.balance,1000 + g);
    const history = [{filament_id:body.filament_id,movement_key:body.idempotency_key,quantity_delta_grams:g,reason:body.reason,note:body.note}];
    assert.equal(applyStock(result.balance,history,body).replayed,true);
  }
});

test('resumo soma material + cor entre marcas, sem misturar tipos ou inventar saldo desconhecido', () => {
  const items=[{id:'a',brand:'Sunlu',material:'PETG',color:'Preto'}, {id:'b',brand:'Print Pulse',material:'PETG',color:'Preto'}, {id:'c',brand:'Sunlu',material:'PLA',color:'Preto'}, {id:'d',brand:'Sunlu',material:'PETG',color:'Branco'}];
  const stock={enabled:true,balances:[{filament_id:'a',quantity_grams:2000},{filament_id:'b',quantity_grams:3500},{filament_id:'c',quantity_grams:1000},{filament_id:'d',quantity_grams:500}]};
  const groups=groupFilamentStock(items,stock);assert.equal(groups.length,3);
  const black=groups.find(g=>g.material==='PETG' && g.color==='Preto');assert.equal(black.quantity_grams,5500);assert.deepEqual(black.brands,['Print Pulse','Sunlu']);
  assert.equal(groupFilamentStock(items,{...stock,unknown_ids:['b']}).find(g=>g.material==='PETG' && g.color==='Preto').quantity_grams,null);
  assert(groupFilamentStock(items,{enabled:false}).every(g=>g.quantity_grams===null));
  assert.equal(filamentEntryDate({reason:'receipt',note:'Data de entrada: 2026-10-10 | Pedido',created_at:'2026-10-11T14:00:00Z'}),'2026-10-10');
  assert.equal(filamentEntryDate({reason:'receipt',created_at:'2026-10-11T14:00:00Z'}),'2026-10-11');
  assert.equal(filamentEntryDate({reason:'adjustment',created_at:'2026-10-11T14:00:00Z'}),'');
  const ui=read('components/print3d/FilamentCatalog.tsx');
  assert.match(ui,/flex w-44 max-w-full/);assert.doesNotMatch(ui,/Mostrar cores|showColors|setShowColors/);assert.match(ui,/color_hex/);assert.match(ui,/Estoque por tipo de filamento e cor/);
  assert.match(ui,/Amostra da cor/);assert.equal((ui.match(/colorPreview\(group.color\)|colorPreview\(f.color\)|colorPreview\(editing.color\)/g) || []).length,3);
  assert.match(ui,/<option value="used">Usado/);assert.match(ui,/<option value="deactivate">Desativar/);
  assert.doesNotMatch(ui,/Ajuste manual|Quantidade a adicionar \/ ajustar/);
  assert.match(ui,/entry_date:entryDate/);assert.match(ui,/entry_date:movementDate/);
});

test('controle de kg usa menos, campo central editável e mais, sem setas nativas', () => {
  const ui = read('components/print3d/FilamentCatalog.tsx');
  assert.match(ui, /changeBy\(-1\)\}>−<\/button>/);
  assert.match(ui, /changeBy\(1\)\}>\+<\/button>/);
  assert.match(ui, /disabled=\{quantity <= min\}/);
  assert.match(ui, /webkit-inner-spin-button\]:appearance-none/);
  assert.match(ui, /text-center tabular-nums/);
  assert.equal((ui.match(/<QuantityKgInput /g) || []).length,2);
  const expression = ui.match(/const changeBy = \(delta:number\) => onChange\((.*)\);/)[1];
  const step = new Function('quantity','delta','min', `return ${expression}`);
  for (const [before,delta,min,after] of [[0,1,0,'1'],[1,1,0,'2'],[2,-1,0,'1'],[0,-1,0,'0'],[0.5,-1,0,'0'],[2.5,1,0,'3.5'],[0,-1,-1000,'-1']]) assert.equal(step(before,delta,min),after);
});

test('calculadora só consome o cadastro; atalhos do produto e links antigos levam à página própria', () => {
  const calculator = read('pages/admin/products/Print3dCostPage.tsx');
  assert.doesNotMatch(calculator, /<FilamentCatalog|import.*FilamentCatalog/);
  assert.match(calculator, /location.hash === '#filamentos'.*<Navigate to="\/admin\/loja-3d\/filamentos" replace/);
  assert.match(calculator, /<Link to="\/admin\/loja-3d\/filamentos"/);
  assert.match(calculator, /setSettings\(current => \(\{ \.\.\.current, filaments:latest.filaments \}\)\)/);
  assert.match(read('components/print3d/QuickCostSimulator.tsx'), /filter\(item => item.active !== false\)/);
});
