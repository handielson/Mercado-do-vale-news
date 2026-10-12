const {test}=require('node:test'),assert=require('node:assert/strict');
const {planModelFamilyRepair}=require('../scripts/repair-model-family.cjs');
const model={id:'m',company_id:'c',name:'Redmi Note 14S'};
const row=(id,patch={})=>({id,model_id:'m',company_id:'c',is_parent:0,parent_id:null,stock_quantity:0,specs:{ram:'12GB',storage:'512GB',color:'Preto'},...patch});
test('one generic parent, active variants and historical children without merging sales/units',()=>{
 const products=[row('parent'),row('available',{parent_id:'parent',stock_quantity:1}),row('historical')];const before=structuredClone(products);
 const p=planModelFamilyRepair({model,products,parentId:'parent',unitCounts:{available:{total:5,available:1},historical:{total:1,available:0}}});
 assert.equal(p.parent.is_parent,1);assert.equal(p.parent.specs.color,undefined);assert.equal(p.parent.specs.ram,undefined);assert.match(p.parent.sku,/^MODELO-/);
 assert.deepEqual(p.activeChildren,['available']);assert.deepEqual(p.archivedChildren,['historical']);assert.equal(p.allChildren.length,2);assert.deepEqual(products,before);
});
test('operational parent, mismatched family and incomplete children are rejected',()=>{
 const base={model,products:[row('parent'),row('child')],parentId:'parent',unitCounts:{}};
 assert.throws(()=>planModelFamilyRepair({...base,unitCounts:{parent:{total:1}}}),/history/);
 assert.throws(()=>planModelFamilyRepair({...base,referenceCounts:{parent:1}}),/history/);
 assert.throws(()=>planModelFamilyRepair({...base,products:[row('parent'),row('child',{company_id:'other'})]}),/scope/);
 assert.throws(()=>planModelFamilyRepair({...base,products:[row('parent'),row('child',{specs:{}})]}),/identity/);
});
