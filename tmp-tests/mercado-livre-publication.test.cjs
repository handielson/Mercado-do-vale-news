const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPublication,createPublicationHandlers,modeOf,calculatePrice,officialFees}=require('../services/mercadoLivrePublication.cjs');
const {listingRows}=require('../services/mercadoLivreServer.cjs');
const {sanitizePacket,parseResult,localResearchPlugin}=require('../scripts/mercado-livre-local-codex.cjs');
const id='11111111-1111-4111-8111-111111111111';
const product={id,sku:'SKU-1',name:'Produto teste',price_cost:5000,price_retail:12345,stock_quantity:3,status:'active',is_parent:0};
const policy={marginBps:2000,taxBps:500,adsBps:100,otherBps:0,packagingCents:100,shippingCents:200,otherFixedCents:0,logisticType:'drop_off',billableWeightGrams:1000};
const category={id:'MLB123',settings:{listing_allowed:true,max_title_length:60,item_conditions:['new']}};
const defs=[{id:'BRAND',name:'Marca',tags:{required:true}},{id:'GTIN',tags:{}},{id:'ANATEL',tags:{}}];
const field=value=>({value,confirmed:true,sources:[{kind:'catalog',reference:'cadastro conferido'}]});
function draft() {
  const values={title:'Produto teste',familyName:'Produto teste',description:'Descrição original',categoryId:'MLB123',condition:'new',priceCents:12345,quantity:2,
    photos:[{url:'https://loja.example/foto.png',rights:'own',evidence:'original'}],attributes:{BRAND:'Marca teste'},
    commercialPolicy:{pricing:policy,listingTypeId:'gold_special',warranty:'Garantia do vendedor',warrantyTime:'90 dias',shipping:{mode:'me2',freeShipping:false,payer:'buyer'}}};
  return {productId:id,sku:'SKU-1',fields:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,field(value)]))};
}
function fixture({timeout=false,descriptionFailure=false,existingSku=false,brokenInventory=false,lock=true,feeRate=0.15,costChanged=false}={}) {
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
    if(sql.includes('FROM products'))return [[{...structuredClone(product),...(costChanged && sql.includes('stock_quantity,status,price_cost')?{price_cost:6000}:{})}]];
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
