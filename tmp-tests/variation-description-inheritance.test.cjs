const test=require('node:test');const assert=require('node:assert/strict');
const {resolveStorefrontDescription}=require('../services/productStorefrontOffer.cjs');
test('os dois catálogos preservam herança padrão e respeitam descrição individual explícita',()=>{
  const product={parent_description:'Descrição atual do pai',description:'Descrição própria'};
  assert.equal(resolveStorefrontDescription(product),'Descrição atual do pai');
  assert.equal(resolveStorefrontDescription({...product,specs:{_inherit_parent_description:false}}),'Descrição própria');
  assert.equal(resolveStorefrontDescription({...product,description:null,specs:JSON.stringify({_inherit_parent_description:false})}),null);
});
test('produto público MDV recebe resolução canônica sem substituir campo original do editor ou vazar custo',()=>{
  const {filterProductPrices}=require('../services/productReadPrivacy.cjs');
  const product={id:'child',parent_id:'parent',parent_description:'<h2>Atual</h2>',description:null,price_cost:1234};
  const publicProduct=filterProductPrices(product,{isAdmin:false,isCommercial:false});
  assert.equal(publicProduct.catalog_description,product.parent_description);
  assert.equal(publicProduct.description,null);
  assert.equal(publicProduct.price_cost,undefined);
  assert.equal(publicProduct.parent_description,undefined);
  const own=filterProductPrices({...product,description:'Própria',specs:{_inherit_parent_description:false}},{isAdmin:true});
  assert.equal(own.catalog_description,'Própria');assert.equal(own.description,'Própria');
  assert.equal(own.price_cost,1234);assert.equal(product.description,null);
  assert(require('node:fs').readFileSync('pages/store/PublicProductPage.tsx','utf8').includes("if (Object.hasOwn(data, 'catalog_description')) data.description = data.catalog_description;"));
});
