const test = require('node:test');
const assert = require('node:assert/strict');
const { listingRows, suggestListingLinks, createListingHandlers, loadMercadoLivreErpProducts, registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');
const { createListingPriceHandlers } = require('../services/mercadoLivreListingPrice.cjs');
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const item = { id: 'MLB123', seller_id: 7, title: 'Produto', status: 'active', seller_custom_field: 'PAI', variations: [
  { id: 1, attributes: [{ id: 'SELLER_SKU', value_name: 'AZUL' }] }, { id: 2, seller_custom_field: 'VERDE' }, { id: 3 },
] };
test('cada variação usa seu próprio SKU; nunca herda SKU do pai', () => {
  assert.deepEqual(listingRows(item).map(row => [row.variationId, row.sku]), [['1','AZUL'],['2','VERDE'],['3','']]);
  assert.equal(listingRows({ ...item, variations: [] })[0].sku, 'PAI');
});
test('descoberta preserva atributos públicos de identificação do anúncio e da variação', () => {
  const rows = listingRows({ ...item,
    attributes: [{ id:'BRAND', name:'Marca', value_name:'Onistek' },
      { id:'GTIN', name:'Código universal', value_name:'7891234567895' },
      { id:'MODEL', name:'Modelo', value_name:'MCD123', access_token:'segredo' }],
    variations: [{ id:1,
      attributes:[{ id:'GTIN', name:'Código universal', value_name:'7891234567895' }],
      attribute_combinations:[{ id:'COLOR', name:'Cor', value_name:'Azul' }] },
    ],
  });
  assert.deepEqual(rows[0].identityAttributes, [
    { id:'BRAND', name:'Marca', value:'Onistek', scope:'item' },
    { id:'GTIN', name:'Código universal', value:'7891234567895', scope:'item' },
    { id:'MODEL', name:'Modelo', value:'MCD123', scope:'item' },
    { id:'GTIN', name:'Código universal', value:'7891234567895', scope:'variation' },
    { id:'COLOR', name:'Cor', value:'Azul', scope:'variation' },
  ]);
  assert.equal(JSON.stringify(rows).includes('segredo'), false);
});
test('SKU único, duplicado, ausente e vínculo existente são distintos', () => {
  const rows = listingRows(item);
  const products = [{ id, sku:'AZUL', name:'Azul' }, { id, sku:'VERDE' }, { id:other, sku:'VERDE' }, { id:'parent', sku:'AZUL', is_parent:1 }];
  assert.deepEqual(suggestListingLinks(rows, products, []).map(row => row.match), ['unique','ambiguous','missing_sku']);
  assert.equal(suggestListingLinks(rows, products, [{ product_id:other, item_id:'MLB123', variation_id:'1' }])[0].match, 'linked');
  assert.equal(suggestListingLinks(rows, [{id,sku:'azul'}], [])[0].match, 'not_found');
});
test('busca usa scan/cursor, isola vendedor e reporta falha parcial sem gravações', async () => {
  const paths=[], sql=[];
  const handlers=createListingHandlers({ settings:async()=>({user_id:'7'}), request:async path=>{
    paths.push(path);
    if(path.startsWith('/users/')) return {results:['MLB123','MLB124'],scroll_id:'next',paging:{total:30}};
    if(path.includes('MLB124')) return {...item,id:'MLB124',seller_id:8};
    return item;
  }, pool:{query:async(statement)=>{sql.push(statement);return [[]];}} });
  const data=await handlers.discover({query:{cursor:'a+/='}});
  assert.match(paths[0],/search_type=scan/); assert.match(paths[0],/scroll_id=a%2B%2F%3D/);
  assert.equal(data.items.length,3); assert.equal(data.errors[0].itemId,'MLB124'); assert.equal(data.nextCursor,'next');
  assert(sql.every(statement=>statement.startsWith('SELECT')));
});
test('fim da paginação não repete cursor e busca manual é limitada/parametrizada', async()=>{
  const queries=[];
  const handlers=createListingHandlers({settings:async()=>({user_id:7}),request:async()=>({results:null,scroll_id:'old'}),pool:{query:async(...args)=>{queries.push(args);return [[]];}}});
  assert.equal((await handlers.discover({query:{}})).nextCursor,null);
  await handlers.candidates({query:{q:"AB' OR 1=1"}});
  assert.match(queries[0][0],/LIMIT 25/);assert.deepEqual(queries[0][1],["AB' OR 1=1","AB' OR 1=1"]);
  await assert.rejects(()=>handlers.candidates({query:{q:'a'}}));
});
function fixture({existing=[], seller=7, accountSeller=7, product=true}={}) {
  const calls=[];
  const connection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),
    query:async(sql,args)=>{calls.push([sql,args]);if(sql.includes('FROM mercado_livre_settings'))return [[{user_id:accountSeller}]];if(sql.includes('FROM products'))return [product?[{id,sku:'LOCAL',is_parent:0}]:[]];if(sql.includes('SELECT product_id'))return [existing];return [{affectedRows:1}];}
  };
  const handlers=createListingHandlers({pool:{getConnection:async()=>connection},settings:async()=>({user_id:7}),request:async()=>({...item,seller_id:seller})});
  return {handlers,calls};
}
const body={productId:id,itemId:'MLB123',variationId:'1',sellerSku:'FORGED'};
test('confirma usando SKU canônico, sem alterar estoque ou anúncio externo',async()=>{
  const {handlers,calls}=fixture();await handlers.link({body});
  const insert=calls.find(call=>Array.isArray(call)&&call[0].startsWith('INSERT'));
  assert.deepEqual(insert[1],[id,'MLB123','1','LOCAL']); assert(calls.includes('commit'));
  assert(!calls.some(call=>Array.isArray(call)&&/UPDATE|DELETE/.test(call[0].replaceAll('FOR UPDATE',''))));
});
test('repetição é idempotente; vínculos conflitantes são preservados com rollback',async()=>{
  const same=fixture({existing:[{product_id:id}]});assert.equal((await same.handlers.link({body})).alreadyLinked,true);
  assert(!same.calls.some(call=>Array.isArray(call)&&call[0].startsWith('INSERT')));
  const conflict=fixture({existing:[{product_id:other}]});await assert.rejects(()=>conflict.handlers.link({body}),{statusCode:409});assert(conflict.calls.includes('rollback'));assert(!conflict.calls.includes('commit'));
});
test('impede anúncio de outra conta, variação inválida, produto ausente e troca de conta',async()=>{
  await assert.rejects(()=>fixture({seller:8}).handlers.link({body}),{statusCode:409});
  await assert.rejects(()=>fixture().handlers.link({body:{...body,variationId:''}}),{statusCode:400});
  await assert.rejects(()=>fixture().handlers.link({body:{...body,variationId:'99'}}),{statusCode:400});
  await assert.rejects(()=>fixture({product:false}).handlers.link({body}),{statusCode:400});
  await assert.rejects(()=>fixture({accountSeller:8}).handlers.link({body}),{statusCode:409});
});
test('rotas de descoberta, busca manual e confirmação exigem autenticação inclusive aliases',async()=>{
  const app=require('fastify')();
  registerMercadoLivreRoutes(app,{pool:{query:()=>{throw Error('Não deveria consultar');}},requireSyncKeyOrAdmin:async(_req,reply)=>reply.code(401).send({error:'Unauthorized'})});
  for(const prefix of ['', '/api'])for(const [method,path] of [['GET','discover'],['GET','candidates'],['POST','link'],['GET','items/MLB123/price'],['POST','items/MLB123/price']]) {
    assert.equal((await app.inject({method,url:`${prefix}/mercado-livre/products/${path}`})).statusCode,401);
  }
  await app.close();
});

test('catálogo ERP pagina por UUID e retorna apenas campos de produto, nunca estoque',async()=>{
  const queries=[];
  const rows=[
    {id:'33333333-3333-4333-8333-333333333333',sku:'SKU-1',name:'Produto 1',description:'Descrição',brand:'Marca',ean:'7891234567890',price_retail:2590,price_cost:1200,weight_kg:'0.125',dimensions:'{"width_cm":5,"height_cm":4,"depth_cm":3}',images:'["https://api.xiaomipetrolina.com.br/images/p1.webp","http://example.test/a.jpg","data:image/png;base64,AAAA"]',status:'active',parent_id:null,is_parent:0,updated_at:'2026-10-29 10:00:00'},
    {id:'44444444-4444-4444-8444-444444444444',sku:'SKU-2',name:'Produto 2',description:'',brand:'',ean:'',price_retail:100,price_cost:0,weight_kg:null,dimensions:null,images:null,status:'inactive',parent_id:null,is_parent:1,updated_at:null},
  ];
  const pool={query:async(sql,args)=>{queries.push({sql,args});return [queries.length===1?rows:[rows[1]]];}};
  const first=await loadMercadoLivreErpProducts(pool,{limit:1});
  assert.equal(first.items.length,1);
  assert.equal(first.items[0].sku,'SKU-1');
  assert.equal(first.items[0].weight_kg,0.125);
  assert.deepEqual(first.items[0].images,['https://api.xiaomipetrolina.com.br/images/p1.webp']);
  assert.equal(first.nextCursor,rows[0].id);
  assert.equal(Object.hasOwn(first.items[0],'stock_quantity'),false);
  assert.doesNotMatch(queries[0].sql,/stock_quantity|stock_locations|stock_quantity/i);
  assert.deepEqual(queries[0].args,[2]);
  const next=await loadMercadoLivreErpProducts(pool,{after:first.nextCursor,limit:1});
  assert.equal(next.after,first.nextCursor);
  assert.equal(next.nextCursor,null);
  assert.deepEqual(queries[1].args,[first.nextCursor,2]);
  await assert.rejects(()=>loadMercadoLivreErpProducts(pool,{after:'invalid',limit:1}),{statusCode:400});
  await assert.rejects(()=>loadMercadoLivreErpProducts(pool,{limit:51}),{statusCode:400});
  assert.equal(queries.length,2);
});

test('catálogo preserva página com preço fracionário em centavos e marca a revisão',async()=>{
  const rows=[
    {id:'55555555-5555-4555-8555-555555555555',sku:'SKU-DECIMAL',name:'Produto decimal',
      price_retail:'1.50',price_cost:'0.00',weight_kg:null,dimensions:null,images:null,status:'active'},
    {id:'66666666-6666-4666-8666-666666666666',sku:'SKU-NEXT',name:'Próximo produto',
      price_retail:'2500.00',price_cost:'1200.00',weight_kg:null,dimensions:null,images:null,status:'active'},
  ];
  const page=await loadMercadoLivreErpProducts({query:async()=>[rows]},{limit:1});
  assert.equal(page.items.length,1);
  assert.equal(page.items[0].price_retail,null);
  assert.equal(page.items[0].price_cost,0);
  assert.deepEqual(page.items[0].price_issues,['price_retail_fractional_cent']);
  assert.equal(page.nextCursor,rows[0].id);
  assert.equal(Object.hasOwn(page.items[0],'stock_quantity'),false);
});

test('catálogo ERP exige chave dedicada de leitura nos dois aliases GET',async()=>{
  const app=require('fastify')();
  const previous=process.env.MERCADO_LIVRE_ERP_READ_KEY;
  const key='r'.repeat(48);
  process.env.MERCADO_LIVRE_ERP_READ_KEY=key;
  try {
    registerMercadoLivreRoutes(app,{pool:{query:async()=>[[]]},requireSyncKeyOrAdmin:async(_req,reply)=>reply.code(401).send({error:'Unauthorized'})});
    for(const prefix of ['', '/api']) {
      const unauthorized=await app.inject({method:'GET',url:`${prefix}/mercado-livre/erp/products`});
      assert.equal(unauthorized.statusCode,401);
      const authorized=await app.inject({method:'GET',url:`${prefix}/mercado-livre/erp/products?limit=10`,headers:{'x-erp-read-key':key}});
      assert.equal(authorized.statusCode,200);
      assert.deepEqual(authorized.json(),{items:[],after:'',nextCursor:null});
    }
    const write=await app.inject({method:'POST',url:'/mercado-livre/erp/products',headers:{'x-erp-read-key':key}});
    assert.notEqual(write.statusCode,200);
  } finally {
    if(previous===undefined) delete process.env.MERCADO_LIVRE_ERP_READ_KEY;
    else process.env.MERCADO_LIVRE_ERP_READ_KEY=previous;
    await app.close();
  }
});


test('consulta todos os preços e bloqueia qualquer escrita sem endpoint oficial de atualização',async()=>{
  const calls=[];
  const handlers=createListingPriceHandlers({
    pool:{query:async()=>[[{id,sku:'SKU-1'}]]},
    settings:async()=>({user_id:'7'}),
    request:async(path,options)=>{
      calls.push({path,options});
      if(path==='/items/MLB123?include_attributes=all') return {id:'MLB123',seller_id:7,status:'active',title:'Produto',variations:[]};
      if(path==='/items/MLB123/prices') return {prices:[
        {type:'standard',amount:25,currency_id:'BRL',conditions:{context_restrictions:['channel_marketplace']}},
        {type:'standard',amount:22,currency_id:'BRL',conditions:{context_restrictions:['channel_marketplace','user_type_business'],min_purchase_unit:5}},
      ]};
      if(path==='/items/MLB123/sale_price?context=channel_marketplace') return {amount:25,currency_id:'BRL',type:'standard'};
      if(path==='/pricing-automation/items/MLB123/automation') throw Object.assign(new Error('not found'),{remoteStatus:404});
      throw new Error(`unexpected request ${path}`);
    },
  });
  const read=await handlers.read({params:{itemId:'MLB123'},query:{parentId:id}});
  assert.equal(read.priceCents,2500);
  assert.equal(read.quantityPricing,true);
  assert.equal(calls.find(call=>call.path==='/items/MLB123/prices').options.headers['show-all-prices'],'true');
  await assert.rejects(()=>handlers.update({params:{itemId:'MLB123'},query:{parentId:id},body:{priceCents:2600,expectedPriceCents:2500}}),
    error=>error.statusCode===409&&/endpoint oficial/.test(error.message));
  assert.equal(calls.some(call=>call.options?.method==='PUT'),false);
});
