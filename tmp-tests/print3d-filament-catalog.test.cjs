'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { version, costPerKg, upsertFilament, applyStock } = require('../services/print3dFilaments.cjs');
const { mergeCosts, registerPrint3dFilamentRoutes } = require('../services/print3dFilamentsServer.cjs');
const references = { brands:['Bambu Lab','Sunlu'], materials:['PLA','PETG'], colors:['Branco','Preto'] };
const filament = (extra = {}) => ({ id:'pla-white', brand:'Bambu Lab', material:'PLA', color:'Branco', costPerKgCents:10000, active:true, ...extra });
const movement = (extra = {}) => ({ filament_id:'pla-white', idempotency_key:randomUUID(), reason:'receipt', note:'Compra', quantity_grams:1000, expected_grams:0, ...extra });
test('degradê valida 2-3 cores cadastradas, persiste composição e impede alterar identidade ou duplicar', () => {
  const refs={...references,colors:[...references.colors,'Azul']};
  const input=filament({colorMode:'gradient',colorNames:['preto','branco'],color:'Texto que não é fonte de verdade'});
  const items=upsertFilament([],input,refs);
  assert.equal(items[0].color,'Degradê: Branco / Preto');
  assert.deepEqual(items[0].colorNames,['Branco','Preto']);
  assert.equal(items[0].colorMode,'gradient');
  assert.throws(()=>upsertFilament(items,{...input,id:'other',colorNames:['Branco','Preto']},refs),{statusCode:409});
  assert.throws(()=>upsertFilament(items,{...input,colorNames:['Branco','Azul']},refs),{statusCode:409});
  assert.throws(()=>upsertFilament(items,{...input,colorMode:'single',colorNames:undefined,color:'Branco'},refs),{statusCode:409});
  for (const names of [[],['Branco'],['Branco','Preto','Azul','Outra'],['Branco','branco'],['Branco','Errada']]) assert.throws(()=>upsertFilament([],{...input,colorNames:names},refs),{statusCode:400});
  assert.throws(()=>upsertFilament([],{...input,colorMode:'unknown'},refs),{statusCode:400});
  const triple=upsertFilament([],{...input,colorNames:['Preto','Azul','Branco']},refs)[0];
  assert.deepEqual(triple.colorNames,['Azul','Branco','Preto']);
  assert.equal(triple.spoolCostCents,10000);assert.equal(triple.spoolGrams,1000);
  // Deactivated component colors remain usable for an existing saved filament.
  const updated=upsertFilament(items,{...items[0],costPerKgCents:12000},{...refs,colors:[]})[0];
  assert.deepEqual(updated.colorNames,items[0].colorNames);assert.equal(updated.id,items[0].id);
});
test('cadastro normaliza kg, mantém IDs, recusa erro de digitação e combinação duplicada', () => {
  const items = upsertFilament([], filament({brand:' bambu lab ',material:'pla',color:'branco'}), references);
  assert.equal(items[0].spoolGrams,1000); assert.equal(items[0].spoolCostCents,10000); assert.equal(items[0].name,'PLA · Bambu Lab');
  assert.throws(() => upsertFilament(items,filament({id:'different'}),references),{statusCode:409});
  assert.throws(() => upsertFilament(items,filament({brand:'Errada'}),references),{statusCode:400});
  assert.throws(() => upsertFilament(items,filament({color:'Preto'}),references),{statusCode:409});
  assert.equal(upsertFilament(items,filament({costPerKgCents:12000}),references)[0].id,'pla-white');
  assert.equal(upsertFilament(items,filament({active:false}),references)[0].active,false);
  assert.throws(() => upsertFilament([],filament({color:'a'.repeat(121)}),{...references,colors:['a'.repeat(121)]}),{statusCode:400});
});
test('cadastro antigo preserva ID e cor; preço antigo por rolo converte para kg sem alterar receita', () => {
  const old = {id:'old',name:'texto livre',color:'Branco',spoolGrams:500,spoolCostCents:6000};
  assert.equal(costPerKg(old),12000);
  const updated = upsertFilament([old],filament({id:'old',costPerKgCents:costPerKg(old)}),references);
  assert.equal(updated[0].id,'old');assert.equal(updated[0].spoolCostCents,12000);
  assert.equal(old.spoolGrams,500);assert.equal(old.spoolCostCents,6000);
});
test('entrada, ajuste, replay e concorrência: não duplica nem admite saldo negativo', () => {
  const body = movement(); const first = applyStock(0,[],body);
  assert.equal(first.balance,1000);
  const history = [{ filament_id:body.filament_id,movement_key:body.idempotency_key,quantity_delta_grams:1000,reason:'receipt',note:'Compra' }];
  assert.equal(applyStock(1000,history,body).replayed,true);
  assert.throws(() => applyStock(1000,history,{...body,note:'Outra compra'}),{statusCode:409});
  assert.throws(() => applyStock(1000,[],movement()),{statusCode:409});
  assert.equal(applyStock(1000,[],movement({reason:'adjustment',quantity_grams:-12.345,expected_grams:1000,note:'Perda'})).balance,987.655);
  assert.throws(() => applyStock(1000,[],movement({reason:'adjustment',quantity_grams:-1001,expected_grams:1000})),{statusCode:409});
  assert.throws(() => applyStock(0,[],movement({quantity_grams:-1})),{statusCode:400});
  assert.throws(() => applyStock(0,[],movement({quantity_grams:0.0001})),{statusCode:400});
  assert.throws(() => applyStock(0,[],movement({idempotency_key:'-'.repeat(36)})),{statusCode:400});
  assert.throws(() => applyStock(999999999.999,[],movement({expected_grams:999999999.999})),{statusCode:400});
});
test('editar tarifas não remove o catálogo nem seus identificadores de estoque', () => {
  const previous = { printerWatts:100,energyCentsPerKwh:100,machineCentsPerHour:100,laborCentsPerHour:2000,packagingCentsPerPiece:0,taxPercent:0,supplies:[],filaments:[filament()] };
  assert.deepEqual(mergeCosts(previous,{filaments:[],machineCentsPerHour:200}).filaments,previous.filaments);
  assert.throws(() => mergeCosts(previous,{energyCentsPerKwh:1.5}),{statusCode:400});
});
function database() {
  const data = { settings:{filaments:[]}, stock:{}, movements:[] };
  let queue = Promise.resolve();
  const query = async (sql,args=[]) => {
    if (sql.startsWith('SHOW COLUMNS')) return [[{Field:'note'}]];
    if (sql.startsWith('SELECT name FROM brands')) return [references.brands.map(name=>({name}))];
    if (sql.startsWith('SELECT name,hex_code FROM colors')) return [references.colors.map(name=>({name,hex_code:name === 'Branco' ? '#ffffff' : '#000000'}))];
    if (sql.startsWith('INSERT IGNORE INTO admin_preferences')) return [{}];
    if (sql.startsWith('SELECT value_json FROM admin_preferences')) return [[{value_json:args[0]==='print3d.materials.v1' ? [] : structuredClone(data.settings)}]];
    if (sql.startsWith('UPDATE admin_preferences')) { data.settings=JSON.parse(args[0]); return [{affectedRows:1}]; }
    if (sql.startsWith('INSERT INTO print3d_filament_stock')) { data.stock[args[0]] ||= {filament_id:args[0],quantity_grams:0};return [{}]; }
    if (sql.startsWith('SELECT * FROM print3d_filament_stock')) return [[structuredClone(data.stock[args[0]])]];
    if (sql.startsWith('SELECT filament_id,movement_key')) return [data.movements.filter(m=>m.movement_key===args[0])];
    if (sql.startsWith('UPDATE print3d_filament_stock')) {data.stock[args[3]].quantity_grams=args[0];return [{affectedRows:1}];}
    if (sql.startsWith('INSERT INTO print3d_filament_movements')) {data.movements.push({id:args[0],filament_id:args[1],movement_key:args[2],quantity_delta_grams:args[3],reason:args[4],note:args[5],actor_id:args[6]});return [{}];}
    if (sql.startsWith('SELECT filament_id,quantity_grams')) return [Object.values(data.stock)];
    if (sql.startsWith('SELECT id,filament_id,movement_key')) return [data.movements];
    throw new Error('Unexpected SQL: '+sql);
  };
  return { data, pool:{query,async getConnection(){let snapshot,unlock;return {query,async beginTransaction(){const before=queue;queue=new Promise(resolve=>{unlock=resolve;});await before;snapshot=structuredClone(data);},async commit(){},async rollback(){Object.assign(data,snapshot);},release(){unlock();}};}} };
}

test('API salva e relê degradê com entrada única e preserva as cores ao editar custo', async t => {
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async()=>({isAdmin:true,userId:'operator'}),stockEnabled:true});
  const status=(await app.inject('/admin/print3d/filaments/status')).json();
  assert(status.colorModes.includes('gradient'));
  const input=filament({colorMode:'gradient',colorNames:['Preto','Branco']});
  const receipt=movement({quantity_grams:2000});
  const saved=await app.inject({method:'POST',url:'/admin/print3d/filaments',payload:{version:version([]),filament:input,receipt}});
  assert.equal(saved.statusCode,200);
  const catalog=(await app.inject('/admin/print3d/filaments')).json();
  assert.deepEqual(catalog.filaments[0].colorNames,['Branco','Preto']);
  assert.equal(data.stock[input.id].quantity_grams,2000);assert.equal(data.movements.length,1);
  const edited=await app.inject({method:'POST',url:'/admin/print3d/filaments',payload:{version:catalog.version,filament:{...catalog.filaments[0],costPerKgCents:12000}}});
  assert.equal(edited.statusCode,200);assert.equal(edited.json().filaments[0].color,'Degradê: Branco / Preto');
  assert.equal(data.stock[input.id].quantity_grams,2000);assert.equal(data.movements.length,1);
});
test('API autenticada aprova catálogo + estoque atomicamente, recupera falha e não duplica no retry', async t => {
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async req=>req.headers.authorization==='Bearer admin' ? {isAdmin:true,userId:'operator'} : null,stockEnabled:true});
  const call = (url,method='GET',payload,auth=true)=>app.inject({url,method,payload,headers:auth ? {authorization:'Bearer admin'} : {}});
  assert.equal((await call('/admin/print3d/filaments','GET',undefined,false)).statusCode,401);
  for(const url of ['/admin/print3d/filaments/status','/admin/print3d/filaments/stock'])assert.equal((await call(url,'GET',undefined,false)).statusCode,401);
  assert.equal((await call('/admin/print3d/filaments/movements','POST',movement(),false)).statusCode,401);
  const normalized = upsertFilament([],filament(),references);
  const { filamentPurchaseNote } = await import('../utils/print3dPurchaseChannel.mjs');
  const stock = movement({note:filamentPurchaseNote({reason:'receipt',note:'Pedido 123'},'Shopee')});
  const payload={base_version:version([]),filaments:normalized,movements:[stock,movement({reason:'adjustment',quantity_grams:-2000,expected_grams:1000,note:'Ajuste inválido'})]};
  assert.equal((await call('/admin/print3d/filaments/approve','POST',payload)).statusCode,409);
  assert.deepEqual(data.settings.filaments,[]);assert.deepEqual(data.stock,{});assert.deepEqual(data.movements,[]);
  payload.movements=[stock];
  assert.equal((await call('/admin/print3d/filaments/approve','POST',payload)).statusCode,200);
  assert.equal(data.stock['pla-white'].quantity_grams,1000);assert.equal(data.movements.length,1);
  assert.equal(data.movements[0].note,'Canal de compra: Shopee | Referência: Pedido 123');
  assert.equal((await call('/admin/print3d/filaments/approve','POST',payload)).statusCode,200);
  assert.equal(data.movements.length,1);
  const adjustment=movement({reason:'adjustment',quantity_grams:-50,expected_grams:1000,note:'Inventário'});
  assert.equal((await call('/admin/print3d/filaments/movements','POST',adjustment)).statusCode,200);
  assert.equal(data.stock['pla-white'].quantity_grams,950);
  assert.equal((await call('/admin/print3d/filaments/movements','POST',movement({expected_grams:1000}))).statusCode,409);
  assert.equal((await call('/admin/print3d/filaments/stock?movement_keys=invalid')).statusCode,400);
  const read=(await call('/admin/print3d/filaments/stock?movement_keys='+stock.idempotency_key)).json();assert.equal(read.balances[0].quantity_grams,950);assert.equal(read.movements.length,2);
});
test('API serialize concorrência de cadastro e bloqueia estoque com módulo desligado',async t=>{
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async()=>({isAdmin:true,userId:'admin'}),stockEnabled:false});
  const requests=await Promise.all([0,1].map(i=>app.inject({method:'POST',url:'/admin/print3d/filaments',payload:{filament:filament({id:'id-'+i}),version:version([])}})));
  assert.deepEqual(requests.map(r=>r.statusCode).sort(),[200,409]);assert.equal(data.settings.filaments.length,1);
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/filaments/movements',payload:movement()})).statusCode,503);
  const initial={filament:filament({id:'new-entry',color:'Preto'}),version:version(data.settings.filaments),receipt:movement({filament_id:'new-entry',quantity_grams:5000})};
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/filaments',payload:initial})).statusCode,503);
  assert.equal(data.settings.filaments.length,1);assert.deepEqual(data.stock,{});
});

test('novo cadastro grava quantidade e canal na mesma transação; erro não salva parcialmente',async t=>{
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async()=>({isAdmin:true,userId:'operator'}),stockEnabled:true});
  const payload={filament:filament(),version:version([]),receipt:movement({quantity_grams:5000,note:'Canal de compra: Shopee'})};
  const save=body=>app.inject({method:'POST',url:'/admin/print3d/filaments',payload:body});
  for(const receipt of [{...payload.receipt,filament_id:'other'},{...payload.receipt,reason:'adjustment'},{...payload.receipt,quantity_grams:0}]) {
    assert.equal((await save({...payload,receipt})).statusCode,400);
    assert.deepEqual(data.settings.filaments,[]);assert.deepEqual(data.stock,{});
  }
  // Force a ledger conflict after catalog write, verifying transaction rollback.
  const collision={filament_id:'other',movement_key:payload.receipt.idempotency_key,quantity_delta_grams:5000,reason:'receipt',note:'Other'};
  data.movements.push(collision);
  assert.equal((await save(payload)).statusCode,409);
  assert.deepEqual(data.settings.filaments,[]);assert.deepEqual(data.stock,{});
  data.movements=[];
  assert.equal((await save(payload)).statusCode,200);
  assert.equal(data.stock['pla-white'].quantity_grams,5000);assert.equal(data.movements[0].note,payload.receipt.note);
  assert.equal((await save(payload)).statusCode,409);
  assert.equal(data.movements.length,1);assert.equal(data.stock['pla-white'].quantity_grams,5000);
});

test('uso baixa apenas consumo; desativação retira saldo inteiro atomicamente e permite replay',async t=>{
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async()=>({isAdmin:true,userId:'operator'}),stockEnabled:true});
  const post=(url,payload)=>app.inject({method:'POST',url,payload});
  const receipt=movement({quantity_grams:5000,entry_date:'2026-10-10'});
  assert.equal((await post('/admin/print3d/filaments',{filament:filament(),version:version([]),receipt})).statusCode,200);
  assert.equal(data.movements[0].note,'Data de entrada: 2026-10-10 | Compra');
  const used=movement({reason:'adjustment',action:'used',expected_grams:5000,quantity_grams:-1000,note:'Teste de impressão'});
  assert.equal((await post('/admin/print3d/filaments/movements',used)).statusCode,200);
  assert.equal(data.stock['pla-white'].quantity_grams,4000);assert.equal(data.settings.filaments[0].active,true);
  assert.equal(data.movements[1].note,'Usado | Teste de impressão');
  const deactivate=movement({reason:'adjustment',action:'deactivate',expected_grams:4000,quantity_grams:-4000,note:'Descarte'});
  assert.equal((await post('/admin/print3d/filaments/movements',{...deactivate,quantity_grams:-1})).statusCode,400);
  assert.equal(data.settings.filaments[0].active,true);assert.equal(data.stock['pla-white'].quantity_grams,4000);
  assert.equal((await post('/admin/print3d/filaments/movements',{...deactivate,expected_grams:5000,quantity_grams:-5000})).statusCode,409);
  assert.equal((await post('/admin/print3d/filaments/movements',deactivate)).statusCode,200);
  assert.equal(data.settings.filaments[0].active,false);assert.equal(data.stock['pla-white'].quantity_grams,0);
  assert.equal((await post('/admin/print3d/filaments/movements',deactivate)).statusCode,200);assert.equal(data.movements.length,3);
  assert.equal((await post('/admin/print3d/filaments/movements',movement())).statusCode,409);
});

test('aprovação mantém ordem de entrada e desativação do rascunho; estoque zero também registra desativação',async t=>{
  const {pool,data}=database();const app=require('fastify')();t.after(()=>app.close());
  registerPrint3dFilamentRoutes(app,{pool,getBearerAuthContext:async()=>({isAdmin:true,userId:'operator'}),stockEnabled:true});
  const receipt=movement({quantity_grams:5000,entry_date:'2026-10-10'});
  const deactivate=movement({reason:'adjustment',action:'deactivate',quantity_grams:-5000,expected_grams:5000,note:'Encerrado'});
  const payload={base_version:version([]),filaments:upsertFilament([],filament({active:false}),references),movements:[receipt,deactivate]};
  const afterDeactivation=movement({quantity_grams:1000});
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/filaments/approve',payload:{...payload,movements:[receipt,deactivate,afterDeactivation]}})).statusCode,409);
  assert.deepEqual(data.stock,{});assert.deepEqual(data.settings.filaments,[]);assert.deepEqual(data.movements,[]);
  for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url:'/admin/print3d/filaments/approve',payload})).statusCode,200);
  assert.equal(data.stock['pla-white'].quantity_grams,0);assert.equal(data.settings.filaments[0].active,false);assert.equal(data.movements.length,2);
  const zero=movement({reason:'adjustment',action:'deactivate',quantity_grams:0,expected_grams:0,note:'Sem estoque'});
  assert.equal(applyStock(0,[],zero).balance,0);
  for(const date of ['2026-02-30','texto','2026-13-01'])assert.throws(()=>applyStock(0,[],movement({entry_date:date})),{statusCode:400});
  assert.throws(()=>applyStock(1000,[],movement({action:'used',reason:'adjustment',expected_grams:1000,quantity_grams:500})),{statusCode:400});
});
