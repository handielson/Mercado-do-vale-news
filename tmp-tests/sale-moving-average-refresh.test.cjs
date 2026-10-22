'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function fixture(fixed, historical = false) {
  const source=fs.readFileSync('services/saleService.ts','utf8');
  const section=source.slice(source.indexOf('export const updateSaleCostsAndProfit ='),source.indexOf('// Estornos pertencem'));
  const patches=[];
  const sale={id:'sale',total:120000,items:[{id:'item',product_id:'phone',serialized_unit_id:'unit',quantity:1,unit_cost:92500}]};
  const context={exports:{},Map,Set,
    loadSaleWithItemsById:async()=>sale,
    moneyToCents:Number,
    vpsApiService:{getProductsByIds:async()=>[{id:'phone',price_cost:500000}]},
    unitService:{listByIds:async()=>[{id:'unit',cost_price:999000}]},
    vpsClient:{get:async()=>({historical,rows:[{unit_id:'unit',unit_cost:fixed}]}),patch:async(path,body)=>patches.push({path,body})},
    calculateSaleProfitFromCurrentData:sale=>({total_cost:sale.items[0].unit_cost,profit:sale.total-sale.items[0].unit_cost}),
    patchSale:async(id,body)=>patches.push({id,body}),
  };
  vm.runInNewContext(ts.transpileModule(section,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {run:()=>context.exports.updateSaleCostsAndProfit('sale'),patches};
}
test('opening/refreshing a sale preserves its frozen average after product and IMEI costs change',async()=>{
  const f=fixture(103133),result=await f.run();
  assert.equal(result.items[0].unit_cost,103133);
  assert.equal(result.cost_total,103133);
  assert.equal(result.profit,16867);
  assert.equal(f.patches[0].body.unit_cost,103133);
});
test('pre-activation sale is returned with its recorded costs and no write on opening',async()=>{
  const f=fixture(103133,true),result=await f.run();
  assert.equal(result.items[0].unit_cost,92500);
  assert.equal(f.patches.length,0);
});
test('a frozen zero cost is retained; an unknown basis rejects refresh without any write',async()=>{
  assert.equal((await fixture(0).run()).cost_total,0);
  const unknown=fixture(null);
  await assert.rejects(unknown.run(),/exige conferência/);
  assert.equal(unknown.patches.length,0);
});
