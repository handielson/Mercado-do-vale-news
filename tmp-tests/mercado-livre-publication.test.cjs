const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPublication,createPublicationHandlers,modeOf,calculatePrice,officialFees,catalogMeasures,publicProduct,reusableAttributes}=require('../services/mercadoLivrePublication.cjs');
const {listingRows,isNonBlockingValidation}=require('../services/mercadoLivreServer.cjs');
const {sanitizePacket,parseResult,localResearchPlugin}=require('../scripts/mercado-livre-local-codex.cjs');
const id='11111111-1111-4111-8111-111111111111';
test('salvar cadastro lembra categoria no modelo e mantém produto salvo se reaproveitamento falhar',async()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../services/mercadoLivreService.ts'),'utf8');
  const ts=require('typescript');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[];let failing=false;const module={exports:{}};
  new Function('require','module','exports',code)(name=>{assert.equal(name,'./vpsClient');return {vpsClient:{post:async(path,body)=>{if(failing)throw Error('offline');calls.push({path,body});return {ok:true};}}};},module,module.exports);
  const service=module.exports.mercadoLivreService,p={id,category_id:'local',model_id:'modelo',specs:{mercado_livre:{category_id:'MLB5095',attributes:{BRAND:'Lcx'}}}};
  assert.equal(await service.rememberCatalogSelection(p),true);assert.equal(calls[0].body.saveForModel,true);assert.equal(calls[0].body.expectedModelId,'modelo');assert.deepEqual(calls[0].body.attributes,{BRAND:'Lcx'});
  failing=true;assert.equal(await service.rememberCatalogSelection(p),false);assert.equal(p.id,id);
  assert.equal(await service.rememberCatalogSelection({...p,specs:{mercado_livre:{...p.specs.mercado_livre,remember_model:false}}}),true);
});
test('cadastro consulta preditor oficial e árvore manual sem escrever ou publicar',async()=>{
  const calls=[];let output=[{category_id:'MLB5095',category_name:'Capas'},{category_id:'MLB5095',category_name:'Duplicada'},{category_id:'MLA1',category_name:'Outro país'}];
  const handlers=createPublicationHandlers({pool:{query:()=>{throw Error('Não deveria gravar');}},settings:async()=>({}),listingRows:()=>[],request:async resource=>{calls.push(resource);return output;}});
  assert.deepEqual(await handlers.discoverCategory({body:{title:'Capa para Realme C85 5G'}}),{suggestions:[{id:'MLB5095',name:'Capas'}]});
  assert.equal(calls[0],'/sites/MLB/domain_discovery/search?q=Capa+para+Realme+C85+5G&limit=3');
  output=[];assert.deepEqual(await handlers.discoverCategory({body:{title:'Produto desconhecido'}}),{suggestions:[]});
  await assert.rejects(handlers.discoverCategory({body:{title:'x'}}),/nome do produto/);
  output=[{id:'MLB1',name:'Acessórios'},{id:'MLA1',name:'Outro país'}];assert.deepEqual((await handlers.browseCategories({query:{}})).categories,[{id:'MLB1',name:'Acessórios'}]);
  output={id:'MLB1',name:'Acessórios',children_categories:[{id:'MLB5095',name:'Capas'}]};assert.equal((await handlers.browseCategories({query:{parentId:'MLB1'}})).categories[0].name,'Capas');
  await assert.rejects(handlers.browseCategories({query:{parentId:'MLB2'}}),/diverge/);
});
const product={id,sku:'SKU-1',name:'Produto teste',price_cost:5000,price_retail:12345,stock_quantity:3,status:'active',is_parent:0};
const policy={marginBps:2000,taxBps:500,adsBps:100,otherBps:0,packagingCents:100,shippingCents:200,otherFixedCents:0,logisticType:'drop_off',billableWeightGrams:1000};
const category={id:'MLB123',settings:{listing_allowed:true,max_title_length:60,item_conditions:['new']}};
const defs=[{id:'BRAND',name:'Marca',tags:{required:true}},{id:'GTIN',tags:{}},{id:'ANATEL',tags:{}}];
const field=value=>({value,confirmed:true,sources:[{kind:'catalog',reference:'cadastro conferido'}]});
test('catálogo herda atributos do modelo/família da mesma categoria, conservando valores próprios',()=>{
  const row={...product,ml_category:{category_id:'MLB123'},ml_model:{category_id:'MLB123',attributes:{MATERIAL:'Silicone',COLOR:'Azul',GTIN:'123'}},ml_parent:{category_id:'MLB123',attributes:{INTERIOR:'Microfibra',MATERIAL:'TPU'}},ml_product:{category_id:'MLB123',attributes:{MATERIAL:'Silicone líquido'}}};
  assert.deepEqual(publicProduct(row).mercado_livre,{categoryId:'MLB123',attributes:{MATERIAL:'Silicone líquido',INTERIOR:'Microfibra'}});
  assert.deepEqual(publicProduct({...row,ml_model:{category_id:'MLB999',attributes:{WRONG:'Outro modelo'}}}).mercado_livre.attributes,{INTERIOR:'Microfibra',MATERIAL:'Silicone líquido'});
  assert.equal(publicProduct(row).ml_model,undefined);
  assert.deepEqual(reusableAttributes({COLOR:'Ciano',OPTION:'valor',INTERNAL:'interno',MATERIAL:'Silicone'},[{id:'OPTION',tags:{variation_attribute:true}},{id:'INTERNAL',tags:{read_only:true}},{id:'MATERIAL',tags:{}}]),{MATERIAL:'Silicone'});
});
test('cadastro guarda ficha na categoria e valores comuns no pai, filhos e modelo preservando outros dados',async()=>{
  const rows=[{...product,category_id:'cat-local',model_id:'modelo',is_parent:1,specs:{color:'Ciano',bling_family:{preservar:true}}},{id:'22222222-2222-4222-8222-222222222222',specs:{color:'Verde',mercado_livre:{category_id:'MLB123',attributes:{COLOR:'Verde',INTERIOR:'Existente'}}}}];
  const categoryRow={config:{ram:'off',custom_fields:[{key:'outro'}]}},modelRow={template_values:{price_cost:100,bling_family:{id:'preservar'}}};
  const writes=[];let committed=false;
  const connection={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{
    if(sql.startsWith('SELECT id,sku'))return [[rows[0]]];if(sql.startsWith('SELECT id,specs'))return [[rows[1]]];
    const namespace=JSON.parse(args[0]);writes.push(sql);
    if(sql.startsWith('UPDATE products'))rows.find(r=>r.id===args[1]).specs.mercado_livre=namespace;
    else if(sql.startsWith('UPDATE models'))modelRow.template_values.mercado_livre=namespace;
    else if(sql.startsWith('UPDATE categories'))categoryRow.config.mercado_livre=namespace;
    else throw Error(sql);return [{affectedRows:1}];
  }};
  const definitions=[{id:'MATERIAL',name:'Material',tags:{}},{id:'COLOR',tags:{allow_variations:true}},{id:'INTERNAL',tags:{read_only:true}}];
  const handlers=createPublicationHandlers({pool:{getConnection:async()=>connection},settings:async()=>({}),request:async resource=>resource.endsWith('/attributes')?definitions:{id:'MLB123',name:'Capas'},listingRows});
  const body={categoryId:'MLB123',attributes:{MATERIAL:'Silicone',COLOR:'Ciano'},saveForFamily:true,saveForModel:true,expectedModelId:'modelo',saveCategorySchema:true,expectedCategoryId:'cat-local'};
  const result=await handlers.saveCatalogAttributes({params:{productId:id},body});assert.equal(result.affectedProducts,2);assert.ok(committed);
  assert.deepEqual(rows[0].specs.mercado_livre.attributes,{MATERIAL:'Silicone'});assert.equal(rows[1].specs.color,'Verde');assert.equal(rows[1].specs.mercado_livre.attributes.COLOR,'Verde');
  assert.deepEqual(rows[0].specs.bling_family,{preservar:true});assert.equal(modelRow.template_values.price_cost,100);assert.deepEqual(modelRow.template_values.mercado_livre.attributes,{MATERIAL:'Silicone'});assert.equal(categoryRow.config.ram,'off');assert.equal(categoryRow.config.custom_fields[0].key,'outro');assert.equal(categoryRow.config.mercado_livre.attributes.length,3);
  assert.ok(writes.every(sql=>!sql.includes('stock_quantity') && !sql.includes('price_retail')));
  const before=writes.length;await assert.rejects(()=>handlers.saveCatalogAttributes({params:{productId:id},body:{...body,expectedModelId:'outro'}}),/associação/);await assert.rejects(()=>handlers.saveCatalogAttributes({params:{productId:id},body:{...body,attributes:{INTERNAL:'x'}}}),/não permitido/);assert.equal(writes.length,before);
});
test('rascunho aproveita categoria e atributos persistidos sem confirmar em nome do operador',()=>{
  const {normalizeProduct,createDraft}=require('../services/mercadoLivrePreparation.ts');
  const p=normalizeProduct({...product,color:'Verde',mercado_livre:{categoryId:'MLB123',attributes:{MATERIAL:'Silicone',COLOR:'Azul'}},specs:{imei:'SEGREDO'}});
  const d=createDraft(p,{products:[p]});assert.equal(d.fields.categoryId.value,'MLB123');assert.equal(d.fields.categoryId.confirmed,false);assert.equal(d.fields.attributes.value.MATERIAL,'Silicone');assert.equal(d.fields.attributes.value.COLOR,'Verde');assert.equal(d.fields.attributes.confirmed,false);assert.ok(!JSON.stringify(p).includes('SEGREDO'));
});
test('atributos opcionais serializam opções oficiais, unidades e não se aplica sem inventar booleanos',()=>{
  const extra=[{id:'WATERPROOF',name:'Resistência',value_type:'boolean',tags:{},values:[{id:'242085',name:'Sim'},{id:'242084',name:'Não'}]}, {id:'MATERIAL',tags:{}},{id:'HEIGHT',value_type:'number_unit',allowed_units:[{id:'cm'}],tags:{}},{id:'NEW_ATTRIBUTE',tags:{new_required:true}}];
  const d=draft();Object.assign(d.fields.attributes.value,{WATERPROOF:'Não',MATERIAL:'__ML_NOT_APPLICABLE__',HEIGHT:'17 cm',NEW_ATTRIBUTE:'Valor'});
  const attrs=buildPublication(d,product,'legacy',category,[...defs,...extra]).attributes;
  assert.deepEqual(attrs.find(a=>a.id==='WATERPROOF'),{id:'WATERPROOF',value_id:'242084',value_name:'Não'});
  assert.deepEqual(attrs.find(a=>a.id==='MATERIAL'),{id:'MATERIAL',value_id:'-1',value_name:null});
  for(const [key,value] of [['WATERPROOF','talvez'],['HEIGHT','17 kg'],['NEW_ATTRIBUTE','__ML_NOT_APPLICABLE__']]){const bad=structuredClone(d);bad.fields.attributes.value[key]=value;assert.throws(()=>buildPublication(bad,product,'legacy',category,[...defs,...extra]));}
  delete d.fields.attributes.value.NEW_ATTRIBUTE;assert.throws(()=>buildPublication(d,product,'legacy',category,[...defs,...extra]),/obrigatório/);
  const varying=structuredClone(d);varying.fields.attributes.value.NEW_ATTRIBUTE='ok';assert.throws(()=>buildPublication(varying,product,'legacy',category,[...defs,...extra.map(a=>a.id==='MATERIAL'?{...a,tags:{allow_variations:true}}:a)]),/Não se aplica/);
});
test('pesquisa recebe atributos opcionais e opções oficiais, sem campos internos nem dados sensíveis',()=>{
  const packet=sanitizePacket({schema:'mdv.ml.preparation.v1',sellerId:'123',products:[{product:{...product,specs:{imei:'SEGREDO'}},currentFields:{categoryId:field('MLB123'),attributes:field({MATERIAL:'Silicone'}),categoryRequirements:field({attributeDefinitions:[{id:'MATERIAL',name:'Material',value_type:'string',tags:{}},{id:'WATERPROOF',name:'À prova de água',value_type:'boolean',tags:{},values:[{id:'1',name:'Sim'}]},{id:'INTERNAL',tags:{read_only:true},name:'SEGREDO'}]})}}]});
  assert.deepEqual(packet.products[0].categoryAttributes.map(a=>a.id),['MATERIAL','WATERPROOF']);
  assert.equal(packet.products[0].categoryAttributes[0].currentValue,'Silicone');assert.equal(packet.products[0].categoryAttributes[1].values[0].name,'Sim');assert.ok(!JSON.stringify(packet).includes('SEGREDO'));
});
test('medidas de cada produto usam cadastro, inteiros com unidade e arredondamento para cima',()=>{
  const p={...product,weight_kg:'0.1000',dimensions:JSON.stringify({height_cm:17,width_cm:8,depth_cm:1.5})};
  assert.deepEqual(catalogMeasures(p),{grams:100,height:17,width:8,length:2});
  assert.deepEqual(catalogMeasures({weight_kg:NaN,dimensions:'inválido'}),{});
  const ids=['SELLER_PACKAGE_HEIGHT','SELLER_PACKAGE_WIDTH','SELLER_PACKAGE_LENGTH','SELLER_PACKAGE_WEIGHT'];
  const payload=buildPublication(draft(),p,'user_products',category,[...defs,...ids.map(id=>({id,tags:{}}))]);
  assert.deepEqual(Object.fromEntries(payload.attributes.filter(a=>ids.includes(a.id)).map(a=>[a.id,a.value_name])),{SELLER_PACKAGE_HEIGHT:'17 cm',SELLER_PACKAGE_WIDTH:'8 cm',SELLER_PACKAGE_LENGTH:'2 cm',SELLER_PACKAGE_WEIGHT:'100 g'});
  assert.equal(buildPublication(draft(),p,'user_products',category,defs).attributes.some(a=>ids.includes(a.id)),false);
});
test('validador aceita somente avisos explícitos, nunca erros ou falhas de criação',()=>{
  const warning={error:'validation_error',cause:[{type:'warning',code:'shipping.lost_me1_by_user'}]};
  assert.equal(isNonBlockingValidation('/items/validate',400,warning),true);
  for(const [resource,status,data] of [['/items',400,warning],['/items/validate',500,warning],['/items/validate',400,{...warning,cause:[]}],['/items/validate',400,{...warning,cause:[...warning.cause,{type:'error'}]}],['/items/validate',400,{...warning,cause:[{}]}],['/items/validate',400,{cause:warning.cause}]]) assert.equal(isNonBlockingValidation(resource,status,data),false);
});
function draft() {
  const values={title:'Produto teste',familyName:'Produto teste',description:'Descrição original',categoryId:'MLB123',condition:'new',priceCents:12345,quantity:2,
    photos:[{url:'https://loja.example/foto.png',rights:'own',evidence:'original'}],attributes:{BRAND:'Marca teste'},
    commercialPolicy:{pricing:policy,listingTypeId:'gold_special',warranty:'Garantia do vendedor',warrantyTime:'90 dias',shipping:{mode:'me2',freeShipping:false,payer:'buyer'}}};
  return {productId:id,sku:'SKU-1',fields:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,field(value)]))};
}
function fixture({timeout=false,descriptionFailure=false,existingSku=false,brokenInventory=false,lock=true,feeRate=0.15,costChanged=false,catalogWeight}={}) {
  const records=new Map(),calls=[];let item=null,description=null,linked=false,failDescription=descriptionFailure;
  const journal={read:async k=>records.get(k),write:async(k,v)=>records.set(k,structuredClone(v))};
  const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{
    if(sql.includes('GET_LOCK'))return [[{acquired:lock?1:0}]];
    if(sql.includes('RELEASE_LOCK'))return [[{}]];
    if(sql.includes('FROM mercado_livre_settings'))return [[{user_id:'123'}]];
    if(sql.includes('FROM products'))return [[{sku:product.sku}]];
    if(sql.includes('SELECT product_id,item_id'))return [linked?[{product_id:id,item_id:'MLB999'}]:[]];
    if(sql.startsWith('INSERT')){linked=true;return [{affectedRows:1}];}
    throw new Error('SQL inesperado: '+sql);
  }};
  const pool={getConnection:async()=>connection,query:async(sql,args)=>{
    if(sql==='SELECT id FROM products WHERE sku=?')return [[{id}]];
    if(sql.includes('FROM products'))return [[{...structuredClone(product),weight_kg:catalogWeight,...(costChanged && sql.includes('stock_quantity,status,price_cost')?{price_cost:6000}:{})}]];
    if(sql.includes('FROM mercado_livre_products'))return [linked?[{item_id:'MLB999'}]:[]];
    throw new Error('SQL inesperado: '+sql);
  }};
  const request=async(resource,options={})=>{
    calls.push({resource,method:options.method || 'GET',body:options.body && JSON.parse(options.body)});
    if(resource==='/users/123')return {id:123,nickname:'Teste',tags:['user_product_seller']};
    if(resource.startsWith('/users/123/items/search'))return {results:existingSku?['MLB888']:[],paging:{total:brokenInventory?1:existingSku?1:0}};
    if(resource==='/categories/MLB123')return category;
    if(resource==='/categories/MLB123/attributes')return defs;
    if(resource==='/items/validate')return null;
    if(resource.startsWith('/sites/MLB/listing_prices?'))return {listing_type_id:'gold_special',currency_id:'BRL',sale_fee_amount:Number(new URL('https://api.example'+resource).searchParams.get('price'))*feeRate,listing_fee_amount:0,sale_fee_details:{fixed_fee:3}};
    if(resource==='/items' && options.method==='POST') {if(timeout)throw new Error('timeout');item={id:'MLB999',seller_id:123,attributes:[{id:'SELLER_SKU',value_name:product.sku}]};return item;}
    if(resource.startsWith('/items/MLB888?'))return {id:'MLB888',seller_id:123,attributes:[{id:'SELLER_SKU',value_name:product.sku}]};
    if(resource.startsWith('/items/MLB999?'))return item;
    if(resource==='/items/MLB999/description'){
      if(options.method){if(failDescription){failDescription=false;throw new Error('falha na descrição');}description=JSON.parse(options.body);return description;}
      if(!description)throw Object.assign(new Error('ausente'),{remoteStatus:404});return description;
    }
    throw new Error('Recurso inesperado: '+resource);
  };
  return {handlers:createPublicationHandlers({pool,settings:async()=>({user_id:'123'}),request,listingRows,journal}),calls,records};
}
const body=()=>({sellerId:'123',draft:draft(),confirmPublication:true});
test('cotação usa peso atual do produto em vez do peso global herdado de outro anúncio',async()=>{
  for(const [catalogWeight,grams] of [[0.100,100],[0.4501,451],[undefined,1000]]) {
    const f=fixture({catalogWeight});const q=await f.handlers.pricing({body:body()});
    assert.equal(q.policy.billableWeightGrams,grams);
    assert.ok(f.calls.filter(c=>c.resource.startsWith('/sites/MLB/listing_prices?')).every(c=>new URL('https://api.example'+c.resource).searchParams.get('billable_weight')===String(grams)));
  }
});
test('rascunho grande preserva anúncios e vínculos completos sem guardar produtos alheios',()=>{
  const {draftFile,restoreDraftFile,parseSnapshot,createBatch,createDraft}=require('../services/mercadoLivrePreparation.ts');
  const parent={...product,id:'22222222-2222-4222-8222-222222222222',sku:'PAI',is_parent:1};
  const child={...product,parent_id:parent.id};
  const unrelated=Array.from({length:2700},(_,n)=>({...product,id:'outro-'+n,sku:'OUTRO-'+n,description:'x'.repeat(4000)}));
  const s=parseSnapshot({schema:'mdv.ml.catalog.v1',sellerId:'123',capturedAt:new Date().toISOString(),complete:true,products:[parent,child,...unrelated],links:[{product_id:'outro-1',item_id:'MLB123'}],listings:[{itemId:'MLB123',sku:'OUTRO-1'}]});
  const batch=createBatch(s);batch.drafts=[createDraft(s.products.find(p=>p.id===child.id),s)];
  const saved=draftFile(batch);assert.ok(JSON.stringify(saved).length<100000);assert.equal(saved.batch.snapshot.products.length,2);assert.deepEqual(saved.batch.snapshot.links,s.links);assert.deepEqual(saved.batch.snapshot.listings,s.listings);assert.equal(restoreDraftFile(saved).drafts[0].sku,child.sku);
});
test('selecionar pai inclui todos os filhos vendáveis sem duplicar vinculados ou sem estoque',()=>{
  const {productGroups,selectionBlock,selectProductGroup,selectedGroupCount,createBatch,parseSnapshot,draftFile,restoreDraftFile}=require('../services/mercadoLivrePreparation.ts');
  const parent={...product,id:'pai',sku:'PAI',brand:'Marca',is_parent:1,stock_quantity:0};
  const children=Array.from({length:8},(_,n)=>({...product,id:'filho-'+n,sku:'SKU-'+n,parent_id:'pai',stock_quantity:n===7?0:1}));
  const s=parseSnapshot({schema:'mdv.ml.catalog.v1',sellerId:'123',capturedAt:new Date().toISOString(),complete:true,products:[parent,...children],links:[{product_id:'filho-0',item_id:'MLB123'}],listings:[{itemId:'MLB124',sku:'SKU-1',status:'paused'}]});
  assert.equal(productGroups(s).length,1);assert.equal(productGroups(s)[0].members.length,8);
  assert.equal(selectionBlock(s,s.products[1]),'Já anunciado');
  const selected=selectProductGroup(createBatch(s),'pai');assert.equal(selected.drafts.length,5);assert.equal(selectedGroupCount(selected),1);
  assert.ok(selected.drafts.every(d=>d.fields.familyName.value==='Produto teste Marca' && d.fields.quantity.value===1 && !d.fields.variations.value.length));
  const edited={...selected.drafts[0],fields:{...selected.drafts[0].fields,title:field('Revisado')}};
  const partial={...selected,drafts:[edited]};const complete=selectProductGroup(partial,'pai');assert.equal(complete.drafts.length,5);assert.equal(complete.drafts[0],edited);
  assert.equal(selectProductGroup(complete,'pai').drafts.length,0);
  const saved=draftFile(complete);assert.equal(saved.batch.snapshot.products.length,9);assert.equal(productGroups(restoreDraftFile(saved).snapshot)[0].members.length,8);
});
test('produto simples e filho sem pai no snapshot continuam selecionáveis',()=>{
  const {productGroups,selectProductGroup,createBatch,parseSnapshot}=require('../services/mercadoLivrePreparation.ts');
  const s=parseSnapshot({schema:'mdv.ml.catalog.v1',sellerId:'123',capturedAt:new Date().toISOString(),complete:true,products:[product,{...product,id:'orfao',sku:'ORFAO',parent_id:'ausente'}],links:[],listings:[]});
  assert.equal(productGroups(s).length,2);assert.equal(selectProductGroup(createBatch(s),'orfao').drafts.length,1);
});
test('snapshot assíncrono reutiliza consulta em andamento e entrega resultado sem segredos',async()=>{
  const f=fixture();const job=await f.handlers.startSnapshot();const same=await f.handlers.startSnapshot();assert.equal(same.id,job.id);
  await new Promise(resolve=>setImmediate(resolve));
  const status=await f.handlers.snapshotStatus({params:{jobId:job.id}});assert.equal(status.status,'complete');assert.equal(status.result.complete,true);assert.equal(status.result.sellerId,'123');
  await assert.rejects(f.handlers.snapshotStatus({params:{jobId:'ausente'}}),/não encontrada/);
});
test('snapshot com inventário incompleto termina em falha e permite nova consulta',async()=>{
  const f=fixture({brokenInventory:true});const job=await f.handlers.startSnapshot();await new Promise(resolve=>setImmediate(resolve));
  const status=await f.handlers.snapshotStatus({params:{jobId:job.id}});assert.equal(status.status,'failed');assert.equal(status.result,undefined);
  const next=await f.handlers.startSnapshot();assert.notEqual(next.id,job.id);
});
test('dinheiro em centavos e contratos legado/User Products separados',()=>{
  const a=buildPublication(draft(),product,'legacy',category,defs),b=buildPublication(draft(),product,'user_products',category,defs);
  assert.equal(a.price,123.45);assert.equal(a.title,'Produto teste');assert.equal(b.family_name,'Produto teste');assert.equal(b.title,undefined);assert.equal(b.variations,undefined);assert.equal(b.sale_terms[1].value_name,'90 dias');
});
test('saldo, campos pendentes, fotos, pai e categoria oficial bloqueiam',()=>{
  for(const change of [d=>d.fields.quantity.value=4,d=>d.fields.title.confirmed=false,d=>d.fields.photos.value[0].rights='unknown',d=>d.fields.attributes.value={},d=>d.fields.variations=field([{sku:'outra'}])]){const d=draft();change(d);assert.throws(()=>buildPublication(d,product,'legacy',category,defs));}
  assert.throws(()=>buildPublication(draft(),{...product,is_parent:1},'legacy',category,defs));
  assert.throws(()=>buildPublication(draft(),product,'legacy',{...category,settings:{listing_allowed:false}},defs));
});
test('certificação e GTIN não podem ser inventados ou copiados de concorrentes',()=>{
  const d=draft();d.fields.attributes.value.ANATEL='123';assert.throws(()=>buildPublication(d,product,'legacy',category,defs),/certificates/);
  delete d.fields.attributes.value.ANATEL;d.fields.gtin=field('7894900011517');d.fields.gtin.sources[0].kind='marketplace_reference';assert.throws(()=>buildPublication(d,product,'legacy',category,defs),/GTIN/);
});
test('consulta de modo exige tags oficiais',()=>{assert.equal(modeOf({tags:[]}), 'legacy');assert.equal(modeOf({tags:['user_product_seller']}),'user_products');assert.throws(()=>modeOf({}));});
test('envio cria uma vez, salva vínculo e descrição; repetição retorna recibo',async()=>{
  const f=fixture();const first=await f.handlers.publish({body:body()});const again=await f.handlers.publish({body:body()});assert.equal(first.itemId,'MLB999');assert.equal(again.alreadyPublished,true);
  assert.equal(f.calls.filter(c=>c.resource==='/items' && c.method==='POST').length,1);
  assert.ok(f.calls.findIndex(c=>c.resource==='/items/validate')<f.calls.findIndex(c=>c.resource==='/items'));
});
test('timeout de criação nunca repete POST automaticamente',async()=>{
  const f=fixture({timeout:true});await assert.rejects(f.handlers.publish({body:body()}),/timeout/);await assert.rejects(f.handlers.publish({body:body()}),/sem resposta conclusiva/);assert.equal(f.calls.filter(c=>c.resource==='/items').length,1);
});
test('falha na descrição retoma anúncio já criado e nunca duplica',async()=>{
  const f=fixture({descriptionFailure:true});await assert.rejects(f.handlers.publish({body:body()}),/descrição/);const result=await f.handlers.publish({body:{...body(),resumeOnly:true}});assert.equal(result.itemId,'MLB999');assert.equal(f.calls.filter(c=>c.resource==='/items').length,1);
});
test('SKU existente, inventário incompleto e publicação concorrente impedem criação',async()=>{
  for(const options of [{existingSku:true},{brokenInventory:true},{lock:false}]){const f=fixture(options);await assert.rejects(f.handlers.publish({body:body()}));assert.equal(f.calls.filter(c=>c.resource==='/items').length,0);}
});
test('retomar sem recibo ou publicar sem confirmação não cria anúncio',async()=>{
  const f=fixture();await assert.rejects(f.handlers.publish({body:{...body(),resumeOnly:true}}),/Não há envio/);await assert.rejects(f.handlers.publish({body:{...body(),confirmPublication:false}}),/Confirme/);assert.equal(f.calls.length,0);
});
test('margem líquida considera todas as despesas e arredonda para cima',async()=>{
  const quote=await calculatePrice(10000,policy,async price=>({saleFeeCents:Math.ceil(price*0.15),listingFeeCents:0,reference:'oficial'}));
  assert.equal(quote.profitCents,quote.priceCents-10000-quote.saleFeeCents-quote.taxCents-quote.adsCents-300);
  assert.ok(quote.profitCents*10000>=quote.priceCents*2000);
  assert.ok(quote.priceCents>10000*1.2);
});
test('tarifa fixa já incluída não é somada duas vezes e resposta incompleta bloqueia',()=>{
  const row={listing_type_id:'gold_special',currency_id:'BRL',sale_fee_amount:18.54,listing_fee_amount:0,sale_fee_details:{fixed_fee:6}};
  assert.equal(officialFees(row,'gold_special','oficial').saleFeeCents,1854);
  for(const value of [{...row,currency_id:'USD'},{...row,sale_fee_amount:null},{...row,listing_fee_amount:undefined},[row,row]])assert.throws(()=>officialFees(value,'gold_special','oficial'));
});
test('custo ausente, política incompleta ou impossível e cotação com falha bloqueiam',async()=>{
  const quote=async()=>({saleFeeCents:0,listingFeeCents:0});
  for(const cost of [0,NaN,-1,1.5])await assert.rejects(calculatePrice(cost,policy,quote));
  await assert.rejects(calculatePrice(5000,{...policy,shippingCents:undefined},quote));
  await assert.rejects(calculatePrice(5000,{...policy,marginBps:9500},quote));
  await assert.rejects(calculatePrice(5000,policy,async()=>{throw new Error('sem cotação');}),/sem cotação/);
  await assert.rejects(calculatePrice(5000,policy,async price=>({saleFeeCents:price,listingFeeCents:0})),/Não foi possível/);
});
test('mudança de faixa de tarifa é recotada no preço final',async()=>{
  const prices=[];const result=await calculatePrice(5000,policy,async price=>{prices.push(price);return {saleFeeCents:Math.ceil(price*0.15)+(price>=8000?2000:500),listingFeeCents:0};});
  assert.ok(prices.length>2);assert.equal(prices.at(-1),result.priceCents);assert.ok(result.meetsTarget);
});
test('tarifas maiores ou custo alterado bloqueiam antes de criar e não aceitam política alternativa no corpo',async()=>{
  for(const options of [{feeRate:0.7},{costChanged:true}]){
    const f=fixture(options);await assert.rejects(f.handlers.publish({body:{...body(),pricingPolicy:{...policy,marginBps:0}}}),/margem|Custo mudou/);
    assert.equal(f.calls.filter(c=>c.resource==='/items').length,0);assert.equal(f.records.size,0);
  }
  const f=fixture();const b=body();delete b.draft.fields.commercialPolicy.value.pricing;
  await assert.rejects(f.handlers.preview({body:b}),/política/);
});
test('pesquisa permite somente catálogo público e não importa aprovações',()=>{
  const packet=sanitizePacket({schema:'mdv.ml.preparation.v1',sellerId:'123',products:[{product:{...product,access_token:'SEGREDO',price_cost:99,specs:{imei:'SEGREDO'}}}]});assert.ok(!JSON.stringify(packet).includes('SEGREDO'));assert.equal(packet.products[0].price_cost,undefined);
  const raw={proposals:[{productId:id,sku:product.sku,fields:[{name:'description',valueJson:'"Texto original"',sources:[{kind:'manufacturer',reference:'https://fabricante.example',note:''}],confirmed:true}]}],notes:[]};
  assert.equal(parseResult(raw,packet).proposals[0].fields.description.confirmed,false);
  raw.proposals[0].fields[0].name='priceCents';assert.throws(()=>parseResult(raw,packet));
});

test('pesquisa preserva cor e modelo do cadastro sem exportar specs privados',()=>{
  const packet=sanitizePacket({schema:'mdv.ml.preparation.v1',sellerId:'123',products:[{product:{...product,color:'Ciano',model_name:'Realme C85 5G',condition:null,specs:{imei:'SEGREDO'}}}]});
  assert.equal(packet.products[0].color,'Ciano');assert.equal(packet.products[0].modelName,'Realme C85 5G');assert.equal(packet.products[0].condition,undefined);assert.ok(!JSON.stringify(packet).includes('SEGREDO'));
});
test('atributos inválidos da IA não descartam descrição válida nem aprovam campos',()=>{
  const packet={sellerId:'123',products:[{productId:id,sku:'SKU-1'}]};
  const sources=[{kind:'catalog',reference:'cadastro conferido'}];
  for(const attributes of [[{name:'Marca',value:'Lcx'}],{'Marca da capa':'Lcx'},{BRAND:12}]) {
    const result=parseResult({proposals:[{productId:id,sku:'SKU-1',fields:[{name:'description',valueJson:'"Descrição"',sources},{name:'attributes',valueJson:JSON.stringify(attributes),sources}]}]},packet);
    assert.equal(result.proposals[0].fields.description.value,'Descrição');assert.equal(result.proposals[0].fields.description.confirmed,false);assert.equal(result.proposals[0].fields.attributes,undefined);assert.match(result.notes[0],/formato inválido/);
  }
});
test('middleware local bloqueia outras origens e aceita pesquisa com execução injetada',async()=>{
  const {Readable}=require('node:stream');let handler;const plugin=localResearchPlugin({research:async()=>({proposals:[]})});plugin.configureServer({middlewares:{use:h=>handler=h}});
  const invoke=async({address='127.0.0.1',origin='http://localhost:3010',marker='1',method='POST'}={})=>{
    const req=Readable.from([JSON.stringify({schema:'mdv.ml.preparation.v1',sellerId:'123',products:[{product}]})]);Object.assign(req,{url:'/__ml-local/research',method,headers:{host:'localhost:3010',origin,'x-mdv-local-research':marker},socket:{remoteAddress:address}});
    const res={statusCode:0,setHeader(){},end(v){this.body=JSON.parse(v);}};await handler(req,res,()=>{throw new Error('next inesperado');});return res;
  };
  assert.equal((await invoke({address:'192.168.1.2'})).statusCode,403);assert.equal((await invoke({origin:'https://outro.example'})).statusCode,403);assert.equal((await invoke({marker:''})).statusCode,403);assert.equal((await invoke()).statusCode,202);
});
