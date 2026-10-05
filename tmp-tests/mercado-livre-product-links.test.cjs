const test = require('node:test');
const assert = require('node:assert/strict');
const { listingRows, suggestListingLinks, createListingHandlers, registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const item = { id: 'MLB123', seller_id: 7, title: 'Produto', status: 'active', seller_custom_field: 'PAI', variations: [
  { id: 1, attributes: [{ id: 'SELLER_SKU', value_name: 'AZUL' }] }, { id: 2, seller_custom_field: 'VERDE' }, { id: 3 },
] };
test('cada variação usa seu próprio SKU; nunca herda SKU do pai', () => {
  assert.deepEqual(listingRows(item).map(row => [row.variationId, row.sku]), [['1','AZUL'],['2','VERDE'],['3','']]);
  assert.equal(listingRows({ ...item, variations: [] })[0].sku, 'PAI');
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
