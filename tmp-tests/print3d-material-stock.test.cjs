'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { receivePrint3dFilament,listPrint3dFilamentStock } = require('../services/print3dMaterialStock.cjs');

function fixture() {
  const data={ balances:{},movements:[],commits:0,rollbacks:0 };
  let queue=Promise.resolve();
  const query=async (sql,args=[]) => {
    if (sql.startsWith('SELECT value_json FROM admin_preferences')) return [[{ value_json:{ filaments:[{id:'pla-black',name:'PLA',color:'Preto'},{id:'petg-white',name:'PETG',color:'Branco'}] } }]];
    if (sql.startsWith('INSERT INTO print3d_filament_stock')) {data.balances[args[0]] ??= {filament_id:args[0],name_snapshot:args[1],color_snapshot:args[2],quantity_grams:0};return [{}];}
    if (sql.startsWith('SELECT * FROM print3d_filament_stock')) return [[structuredClone(data.balances[args[0]])]];
    if (sql.startsWith('SELECT id,filament_id,quantity_delta_grams,reason FROM print3d_filament_movements')) return [data.movements.filter(item=>item.movement_key===args[0])];
    if (sql.startsWith('UPDATE print3d_filament_stock')) {const row=data.balances[args[3]];row.quantity_grams+=args[0];row.name_snapshot=args[1];row.color_snapshot=args[2];return [{affectedRows:1}];}
    if (sql.startsWith('INSERT INTO print3d_filament_movements')) {data.movements.push({id:args[0],filament_id:args[1],movement_key:args[2],quantity_delta_grams:args[3],reason:args[4]});return [{}];}
    if (sql.startsWith('SELECT filament_id,name_snapshot')) return [Object.values(data.balances).map(row=>({...row,updated_at:'2026-09-27'}))];
    throw Error('SQL inesperado: '+sql);
  };
  const pool={query,async getConnection(){let release,snapshot;return {query,async beginTransaction(){const prev=queue;queue=new Promise(resolve=>{release=resolve});await prev;snapshot=structuredClone(data);},async commit(){data.commits++;},async rollback(){Object.assign(data,snapshot);data.rollbacks++;},release(){release();}};}};
  return {data,pool};
}

test('entrada de rolo registra saldo e movimento uma vez, mesmo em repetição',async()=>{
  const {data,pool}=fixture();const idempotency_key=randomUUID();
  const first=await receivePrint3dFilament(pool,{actorId:'admin',body:{filament_id:'pla-black',quantity_grams:1000,idempotency_key}});
  assert.equal(first.quantity_grams,1000);assert.equal(first.replayed,false);
  assert.equal((await receivePrint3dFilament(pool,{actorId:'admin',body:{filament_id:'pla-black',quantity_grams:1000,idempotency_key}})).replayed,true);
  assert.equal(data.movements.length,1);assert.equal((await listPrint3dFilamentStock(pool))[0].quantity_grams,1000);
  await assert.rejects(receivePrint3dFilament(pool,{actorId:'admin',body:{filament_id:'pla-black',quantity_grams:500,idempotency_key}}),{statusCode:409});
  await assert.rejects(receivePrint3dFilament(pool,{actorId:'admin',body:{filament_id:'petg-white',quantity_grams:1000,idempotency_key}}),{statusCode:409});
  assert.equal(data.balances['pla-black'].quantity_grams,1000);
  assert.equal(data.balances['petg-white'],undefined);
});
test('entrada recusa filamento inexistente no cadastro de custos',async()=>{
  const {data,pool}=fixture();
  await assert.rejects(receivePrint3dFilament(pool,{actorId:'admin',body:{filament_id:'other',quantity_grams:100,idempotency_key:randomUUID()}}),{statusCode:409});
  assert.deepEqual(data.balances,{});
});
