'use strict';
const fs=require('node:fs'),path=require('node:path');
const ENTRIES=['server.js','vps_server.js','vps_server.cjs'];
const ROUTES=['/products','/products/by-ids','/products/:id','/products/by-slug/:slug','/products/by-ean/:ean'];
function block(source,anchor,end='\n});'){
 source=source.replace(/\r\n/g,'\n');const start=source.indexOf(anchor),stop=source.indexOf(end,start);
 if(start<0||stop<start||source.indexOf(anchor,start+1)>=0)throw Error('Missing/ambiguous media contract block: '+anchor);
 return source.slice(start,stop+end.length);
}
function assertCatalogMediaContract(read){
 let helper;
 for(const file of ENTRIES){
  const source=read(file),current=block(source,'function productFamilyNameSelectSql(','\n}');
  if(!current.includes('AS parent_images')||!current.includes('AS parent_image_url'))throw Error(file+': missing parent image projection');
  if(helper&&current!==helper)throw Error(file+': divergent family projection');helper=current;
  for(const route of ROUTES){const s=block(source,"fastify.get('"+route+"',");
   if(!s.includes("${productFamilyNameSelectSql('products')}") && !s.includes("${productFamilyNameSelectSql('products', true)}"))throw Error(file+': parent media disconnected from '+route);
   if(route==='/products'&&!s.includes("${productFamilyNameSelectSql('products', true)}"))throw Error(file+': compact parent cover missing');
  }
  const seo=block(source,"fastify.get('/api/seo-produto',");
  if(!seo.includes("require('./services/socialPreviewImage.cjs').resolveSocialPreviewImage(publicImages[0]"))throw Error(file+': social preview disconnected');
 }
 return {entries:ENTRIES.length,readRoutes:ROUTES.length,sharedProjection:true};
}
if(require.main===module)console.log(JSON.stringify(assertCatalogMediaContract(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8'))));
module.exports={ENTRIES,ROUTES,block,assertCatalogMediaContract};
