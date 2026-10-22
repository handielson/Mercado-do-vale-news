'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function fixture(quote) {
  const source=fs.readFileSync('components/pdv/ProductSearchSection.tsx','utf8');
  const section=source.slice(source.indexOf('const confirmSerializedUnit ='),source.indexOf('const addCardToCart ='));
  const calls=[],errors=[];
  const product={id:'phone',model_id:'model',name:'Phone',price_cost:92500,price_retail:97200};
  const context={exports:{},
    pendingSerializedConfirmation:{product,unitOptions:[{id:'selected',unitData:{unitId:'unit'}}],selectedOptionId:'selected',source:'imei'},
    isConfirmingUnit:false,smartphonePriceGroups:{reference:async(modelId,p)=>{assert.equal(modelId,'model');assert.equal(p,product);return quote;}},
    toast:{error:message=>errors.push(message),success:()=>{}},
    onAddToCart:(p,q,data)=>calls.push({p,q,data}),
    setIsConfirmingUnit:()=>{},setPendingSerializedConfirmation:()=>{},setImeiQuery:()=>{},setSearchCards:()=>{},setSearchTerm:()=>{},setTimeout:()=>{},
  };
  vm.runInNewContext(ts.transpileModule(section+';exports.confirm=confirmSerializedUnit;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {run:context.exports.confirm,calls,errors,product};
}
test('confirmed IMEI carries the current average into the cart without changing purchase or sale price',async()=>{
  const f=fixture({controlled:true,moving_average_cost:103133});await f.run();
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].data.unitId,'unit');
  assert.equal(f.calls[0].data.movingAverageCost,103133);
  assert.equal(f.product.price_cost,92500);
  assert.equal(f.product.price_retail,97200);
  const page=fs.readFileSync('pages/pdv/PDVPage.tsx','utf8');
  assert.match(page,/normalizeCentValue\(unitData\?\.movingAverageCost \?\? product\.price_cost\)/);
});
test('unknown average prevents adding the IMEI; a known zero remains valid',async()=>{
  const unknown=fixture({controlled:true,moving_average_cost:null});await unknown.run();
  assert.equal(unknown.calls.length,0);assert.equal(unknown.errors.length,1);
  const free=fixture({controlled:true,moving_average_cost:0});await free.run();
  assert.equal(free.calls[0].data.movingAverageCost,0);
});
