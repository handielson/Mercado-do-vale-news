'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {receivePrint3dSupply,listPrint3dSupplyStock,unitsToMicros}=require('../services/print3dSupplyStock.cjs');

function fixture() {
  const settings={supplies:[{id:'argola',name:'Argola',unitLabel:'un'},{id:'cola',name:'Cola',unitLabel:'ml'}],packagingCentsPerPiece:100};
  const data={balances:{},movements:[],commits:0,rollbacks:0};
  let queue=Promise.resolve();
  const query=async(sql,args=[])=>{
    if(sql.startsWith('SELECT value_json FROM admin_preferences')) return [[{value_json:settings}]];
    if(sql.startsWith('INSERT INTO print3d_supply_stock')) {data.balances[args[0]] ??={supply_id:args[0],name_snapshot:args[1],unit_snapshot:args[2],quantity_units:0};return [{}];}
    if(sql.startsWith('SELECT * FROM print3d_supply_stock')) return [[structuredClone(data.balances[args[0]])]];
    if(sql.startsWith('SELECT supply_id,quantity_delta_units,reason FROM print3d_supply_movements')) return [data.movements.filter(item=>item.movement_key===args[0])];
    if(sql.startsWith('UPDATE print3d_supply_stock')) {const row=data.balances[args[3]];row.quantity_units+=args[0];row.name_snapshot=args[1];row.unit_snapshot=args[2];return [{affectedRows:1}];}
    if(sql.startsWith('INSERT INTO print3d_supply_movements')) {data.movements.push({supply_id:args[1],movement_key:args[2],quantity_delta_units:args[3],reason:args[4]});return [{}];}
    if(sql.startsWith('SELECT supply_id,name_snapshot')) return [Object.values(data.balances).map(row=>({...row,updated_at:'2026-09-27'}))];
    throw Error('SQL inesperado: '+sql);
  };
  const pool={query,async getConnection(){let release,snapshot;return {query,async beginTransaction(){const prev=queue;queue=new Promise(resolve=>{release=resolve});await prev;snapshot=structuredClone(data);},async commit(){data.commits++;},async rollback(){Object.assign(data,snapshot);data.rollbacks++;},release(){release();}};}};
  return {settings,data,pool};
}

test('recebe insumo fracionado e embalagem sem repetir saldo na mesma chave',async()=>{
  const {data,pool}=fixture(),key=randomUUID();
  const first=await receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'cola',quantity_units:12.5,idempotency_key:key}});
  assert.equal(first.quantity_units,12.5);assert.equal(first.replayed,false);
  assert.equal((await receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'cola',quantity_units:12.5,idempotency_key:key}})).replayed,true);
  await receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'packaging-per-piece',quantity_units:100,idempotency_key:randomUUID()}});
  assert.equal(data.movements.length,2);assert.equal((await listPrint3dSupplyStock(pool)).length,2);
  await assert.rejects(receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'cola',quantity_units:13,idempotency_key:key}}),{statusCode:409});
  assert.equal(data.balances.cola.quantity_units,12.5);
});

test('recusa unidade alterada com saldo, ID não cadastrado e fração além da precisão',async()=>{
  const {settings,data,pool}=fixture();
  assert.equal(unitsToMicros(0.123456),123456);
  assert.equal(unitsToMicros(0.1234567),null);
  await assert.rejects(receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'outro',quantity_units:1,idempotency_key:randomUUID()}}),{statusCode:409});
  await receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'argola',quantity_units:10,idempotency_key:randomUUID()}});
  settings.supplies[0].unitLabel='caixa';
  await assert.rejects(receivePrint3dSupply(pool,{actorId:'admin',body:{supply_id:'argola',quantity_units:1,idempotency_key:randomUUID()}}),{statusCode:409});
  assert.equal(data.balances.argola.quantity_units,10);
});
