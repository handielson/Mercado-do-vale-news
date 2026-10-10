const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const rows=new Map(),bulk=[];
 const api={getProducts:async query=>[...rows.values()].filter(row=>query.sku?row.sku===query.sku:row.model_id===query.model_id),
  createProduct:async payload=>{rows.set(payload.id,structuredClone(payload));return {errors:[],resolved:[{requested_id:payload.id,id:payload.id}]};},
  getProductById:async id=>rows.get(id),updateProduct:async(id,payload)=>{rows.set(id,structuredClone(payload));return true;},
  bulkSyncPricesStock:async updates=>{bulk.push(...updates);for(const update of updates)Object.assign(rows.get(update.id),update);return {ok:true};}};
 const imports={
  '../utils/field-standards':{ProductStatus:{ACTIVE:'active'}},'./vpsApiService':{vpsApiService:api},
  './categories':{categoryService:{getById:async()=>({name:'Smartphones'})}},
  './models':{modelService:{getById:async()=>({name:'Modelo local',category_id:'local-category',template_values:{material:'PLA',size:'P',finish:'Fosco',ram:'8',storage:'128'}})}},
  './brands':{brandService:{}},'./priceHistoryService':{logPriceChange:async()=>{}},
  './companyContext':{getCompanyId:async()=>'local-company'},'../utils/video-url':{},
  '../utils/cross-sell-tags':{ensureTag:tags=>tags,parseTagsVenda:()=>[]},'./shopeeProducts':{shopeeProductService:{getByProductIds:async()=>[]}},
  './blingNameSyncPolicy.js':{markLocalNameManaged:specs=>specs},
  './localCatalogPreview':{isLocalCatalogPreviewRuntime:()=>false},
  './mercadoLivreService':{mercadoLivreService:{rememberCatalogSelection:async()=>true}},
  'sonner':{toast:{warning(){}}},
  './smartphoneModelSpecs.mjs':{isSmartphoneModel:()=>true,stripModelOwnedSpecs:specs=>specs},
  './smartphonePriceGroups':{smartphonePriceGroups:{reference:async()=>({controlled:false})}},
 };
 const context={exports:{},crypto:require('node:crypto'),console:{info(){},warn(){},error(){}},require:name=>{assert(name in imports,name);return imports[name];}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/products.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {service:context.exports.productService,rows,bulk};
}
const input=(sku,price,specs={})=>({model_id:'local-model',name:'Peça de teste',sku,brand:'Local',is_print3d:true,track_inventory:true,stock_quantity:3,status:'active',price_cost:100,price_retail:price,price_reseller:price,price_wholesale:price,specs});
test('3D create/read/update preserves dimensions of variation and never synchronizes sibling prices',async()=>{
 const f=fixture();const small=await f.service.create(input('3D-P',2500,{color:'Preto'}));
 const large=await f.service.create(input('3D-G',3500,{material:'PETG',size:'Grande',finish:'Brilhante',color:'Preto'}));
 assert.equal(f.bulk.length,0,'3D variants must not enter smartphone price synchronization');
 for(const [key,value] of Object.entries({material:'PETG',size:'Grande',finish:'Brilhante',color:'Preto'}))assert.equal(large.specs[key],value);
 const changed=await f.service.update(large.id,input('3D-G',3900,{material:'Resina',size:'Grande',finish:'Pintado',color:'Azul'}));
 assert.equal(changed.specs.material,'Resina');assert.equal(changed.specs.finish,'Pintado');assert.equal(changed.price_retail,3900);
 assert.equal((await f.service.getById(small.id)).price_retail,2500);assert.equal(f.bulk.length,0);
});
test('3D SKU conflicts are rejected even when model category is serialized',async()=>{
 const f=fixture();await f.service.create(input('3D-UNIQUE',2500));
 await assert.rejects(f.service.create(input('3D-UNIQUE',3500)),/SKU.*já está em uso/);
 const second=await f.service.create(input('3D-OTHER',3500));
 await assert.rejects(f.service.update(second.id,input('3D-UNIQUE',3900)),/SKU.*não pode ser alterado/);
 assert.equal(f.rows.size,2);
});

test('single measurement record survives create/read/update without changing sibling SKUs',async()=>{
 const f=fixture();
 const payload={...input('PIECE-MEASURE',2500,{material:'PETG'}),dimensions:{height_cm:3.5,width_cm:2,depth_cm:1.2},weight_kg:0.012};
 const created=await f.service.create(payload);
 const read=await f.service.getById(created.id);
 assert.equal(read.weight_kg,0.012);assert.equal(read.dimensions.height_cm,3.5);
 const sibling=await f.service.create({...input('OTHER-MEASURE',3500),dimensions:{height_cm:5}});
 const updated=await f.service.update(created.id,{...payload,dimensions:{...payload.dimensions,height_cm:4},weight_kg:0.02});
 assert.equal(updated.dimensions.height_cm,4);assert.equal(updated.weight_kg,0.02);
 assert.equal(updated.dimensions.width_cm,2);
 assert.equal((await f.service.getById(sibling.id)).dimensions.height_cm,5);
 assert(!Object.keys(updated.specs).some(key=>key.startsWith('piece_')));
});
test('legacy phone price synchronization cannot overwrite a 3D peer',async()=>{
 const f=fixture();const piece=await f.service.create(input('3D-PIECE',2500));
 const phoneInput={...input('PHONE',5000),is_print3d:false};
 await f.service.create(phoneInput);
 assert.equal((await f.service.getById(piece.id)).price_retail,2500);assert.equal(f.bulk.length,0);
 const phone2=await f.service.create({...phoneInput,sku:'PHONE-2',price_retail:6000});
 assert.equal(f.bulk.length,0,'uncontrolled price reference must not synchronize any peers');
 assert.equal((await f.service.getById(piece.id)).price_retail,2500);assert.equal(phone2.price_retail,6000);
});
