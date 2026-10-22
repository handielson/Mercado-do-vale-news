'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../services/smartphoneMovingAverageCore.cjs');
const prices = require('../services/smartphonePriceGroupsCore.cjs');
const model = { id: 'redmi', company_id: 'store', category_name: 'Smartphones' };
const product = (id, extra = {}) => ({ id, model_id: model.id, specs: { ram: '4GB', storage: '256GB', version: 'Global', color: id }, ...extra });
const unit = (id, cost, status = 'available') => ({ id, product_id: id, cost_price: cost, status });
function fixture() {
  const rows = [92500, 99900, 117000].map((cost, i) => ({ product: product('p'+i), unit: unit('p'+i, cost) }));
  const state = core.initialize(rows, model);
  const id = prices.configuration(rows[0].product, model).id;
  return { state, id, rows, avg: () => core.average(state.groups[id]) };
}
test('any selected IMEI uses the same moving average and its real purchase remains unchanged', () => {
  for (const index of [0, 1, 2]) {
    const f = fixture(), row = f.rows[index];
    const before = structuredClone(f.rows);
    const sale = core.applyUnit(f.state, row.product, { ...row.unit, status: 'sold', sale_id: 'sale' }, model, { strictSale: true });
    assert.equal(sale.unit_cost, 103133);
    assert.equal(sale.purchase_cost, row.unit.cost_price);
    assert.equal(f.avg(), 103133);
    assert.equal(f.state.groups[f.id].quantity, 2);
    assert.deepEqual(f.rows, before);
  }
});
test('every receipt recalculates the remaining book balance, independent of the day', () => {
  const f = fixture();
  core.applyUnit(f.state, f.rows[0].product, {...f.rows[0].unit, status:'sold',sale_id:'sale'}, model);
  core.applyUnit(f.state, product('new'), unit('new', 90000), model);
  assert.equal(f.avg(), 98756);
  assert.equal(f.state.groups[f.id].quantity, 3);
});
test('rounding is carried across sales, conserves all cents and empties the book balance', () => {
  const f = fixture();
  const snapshots = f.rows.map((row, i) => core.applyUnit(f.state, row.product, {...row.unit,status:'sold',sale_id:'s'+i}, model));
  assert.deepEqual(snapshots.map(s=>s.unit_cost), [103133,103134,103133]);
  assert.equal(snapshots.reduce((sum,s)=>sum+s.unit_cost,0),309400);
  assert.equal(f.state.groups[f.id].value,'0');
  assert.equal(f.avg(), null);
});
test('cancellation restores the original sale book value even after another receipt or purchase correction', () => {
  const f = fixture(), row = f.rows[0];
  const snapshot = core.applyUnit(f.state,row.product,{...row.unit,status:'sold',sale_id:'s'},model);
  core.applyUnit(f.state,product('new'),unit('new',90000),model);
  core.applyUnit(f.state,row.product,{...row.unit,status:'sold',sale_id:'s',cost_price:100000},model);
  core.applyUnit(f.state,row.product,{...row.unit,cost_price:100000},model);
  assert.equal(f.avg(),99850);
  assert.equal(snapshot.unit_cost,103133);
  assert.equal(snapshot.purchase_cost,92500);
});
test('in-stock corrections change the current pool, never a completed sale snapshot', () => {
  const f=fixture(), row=f.rows[0];
  const snapshot=core.applyUnit(f.state,row.product,{...row.unit,status:'sold',sale_id:'s'},model);
  core.applyUnit(f.state,f.rows[1].product,{...f.rows[1].unit,cost_price:100900},model);
  assert.equal(f.avg(),103633);
  assert.equal(snapshot.unit_cost,103133);
});
test('sold history does not seed the opening pool; reserved units retain book value and hidden units leave it', () => {
  const p=product('phone');
  const state=core.initialize([
    {product:p,unit:unit('sold',100,'sold')},{product:p,unit:unit('a',90000)},
    {product:p,unit:unit('r',110000,'reserved')},{product:p,unit:unit('h',100,'hidden')},
  ],model);
  const id=prices.configuration(p,model).id;
  assert.equal(core.average(state.groups[id]),100000);
  core.applyUnit(state,p,unit('a',90000,'hidden'),model);
  assert.equal(core.average(state.groups[id]),100000);
  core.applyUnit(state,p,unit('a',90000),model);
  assert.equal(core.average(state.groups[id]),100000);
});
test('configurations separate RAM, storage, version, condition and company but combine colors',()=>{
  const state=core.empty();
  for(const [id,extra] of [['a',{}],['b',{}],['ram',{specs:{ram:'8GB',storage:'256GB',version:'Global'}}],['storage',{specs:{ram:'4GB',storage:'128GB',version:'Global'}}],['condition',{condition:'used'}],['company',{company_id:'other'}],['version',{specs:{ram:'4GB',storage:'256GB',version:'India'}}]]) {
    core.applyUnit(state,product(id,extra),unit(id,10000),model);
  }
  assert.equal(Object.keys(state.groups).length,6);
  assert.equal(state.groups[prices.configuration(product('a'),model).id].quantity,2);
});
test('moving a product to another model removes it from the previous model ledger',()=>{
  const f=fixture(),row=f.rows[0];
  core.applyEvent(f.state,{before_data:{product:row.product,unit:row.unit},after_data:{product:{...row.product,model_id:'other'},unit:row.unit}},model);
  assert.equal(f.state.groups[f.id].quantity,2);
  assert.equal(Object.keys(f.state.groups).length,1);
  assert.equal(f.avg(),103133);
});
test('unknown purchase cost blocks sale; known zero is valid and journal replay does not double-decrement',()=>{
  const p=product('p'), state=core.initialize([{product:p,unit:unit('p',null)}],model);
  assert.throws(()=>core.applyUnit(state,p,{...unit('p',null,'sold'),sale_id:'s'},model,{strictSale:true}),/valor de compra/);
  core.applyUnit(state,p,unit('p',0),model);
  const sold={...unit('p',0,'sold'),sale_id:'s'};
  const snapshot=core.applyUnit(state,p,sold,model,{strictSale:true});
  assert.equal(snapshot.unit_cost,0);
  const before=structuredClone(state);
  assert.equal(core.applyEvent(state,{after_data:JSON.stringify({product:p,unit:sold})},model),null);
  assert.deepEqual(state,before);
});
