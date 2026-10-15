import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolveProductFamilyImages} from '../services/productFamilyImages.js';
const require=createRequire(import.meta.url);
const {assertCatalogMediaContract,ENTRIES,block}=require('../scripts/assert-catalog-media-contract.cjs');
const ts=require('typescript');
test('the real public card image callback keeps parent cover on both initial and selected-color state',()=>{
 const text=fs.readFileSync('components/catalog/ModernProductCard.tsx','utf8');
 const ast=ts.createSourceFile('card.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='getImageUrl')fn=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(fn);
 const code=ts.transpileModule('exports.getImage='+fn,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const product={id:'child',parent_id:'parent',name:'Phone',images:['child.jpg'],parent_images:['parent.jpg'],specs:{color:'Preto'}};
 for(const currentColorIndex of [-1,0]){const context={exports:{},resolveProductFamilyImages,currentProduct:product,product,productGroup:{variants:[{products:[product]}]},relatedProducts:[],currentColorIndex};vm.runInNewContext(code,context);assert.equal(context.exports.getImage(),'parent.jpg');product.parent_images=[];assert.equal(context.exports.getImage(),'child.jpg');product.parent_images=['parent.jpg'];}
});
test('every deployable API entry retains family media on real read routes and social HTML',()=>{
 assert.equal(assertCatalogMediaContract(file=>fs.readFileSync(file,'utf8')).entries,3);
 assert.throws(()=>assertCatalogMediaContract(file=>execFileSync('git',['show','5e9e8f60:'+file],{encoding:'utf8',maxBuffer:15e6})),/media contract|parent|social/);
 for(const target of ENTRIES)assert.throws(()=>assertCatalogMediaContract(file=>fs.readFileSync(file,'utf8').replace(file===target?"${productFamilyNameSelectSql('products', true)}":'unmatched','NULL')),/compact/);
});
for(const file of ENTRIES)test(file+': shared readable alias uses the existing SEO owner instead of redirecting a real product away',async()=>{
 const source=fs.readFileSync(file,'utf8');let resolved=0;
 const row={id:'support',slug:'suporte-carona-universal-1',is_parent:0,images:['support.webp'],specs:{color:'Preto'}};
 const context={fastify:{get:(...args)=>context.handler=args.at(-1)},pool:{query:async sql=>[sql.includes('FROM products WHERE id = ?')?[row]:[]]},
  loadSeoProductBySlug:async slug=>{resolved++;return slug==='suporte-carona-universal-1-preto'?row:null;},modelBlueprintSelectSql:()=> 'NULL AS blueprint_image_url',comboStockSql:()=> 'stock_quantity',normalizeProductSpecsRam:x=>x};
 vm.runInNewContext(block(source,'function productFamilyNameSelectSql(','\n}'),context);vm.runInNewContext(block(source,"fastify.get('/products/by-slug/:slug',"),context);
 const result=await context.handler({params:{slug:'suporte-carona-universal-1-preto'}},{code(){throw Error('Unexpected 404');}});assert.equal(result.id,'support');assert.equal(resolved,1);
 let status;const missing=await context.handler({params:{slug:'nonexistent'}},{code(n){status=n;}});assert.equal(status,404);assert.equal(missing.error,'Not found');
});
test('selective media publication preserves integrations, rejects drift and cannot replace the whole entry',()=>{
 const {versions,patch}=require('../scripts/deploy-catalog-media.cjs'),choices=versions(process.cwd());
 for(const v of choices){const remote='// integration retained\n'+v.before,result=patch(remote,choices);assert.equal(result.replace(/\r\n/g,'\n'),'// integration retained\n'+v.after);assert.equal(patch(result,choices),result);assert.throws(()=>patch(remote.replace('const cols = compact','const cols = changed'),choices),/drift/);}
});
for(const file of ENTRIES)test(file+': actual detail handler SQL transports parent fields independently from own gallery',async()=>{
 const source=fs.readFileSync(file,'utf8');let query;
 const row={id:'child',parent_id:'parent',name:'Telefone',images:'["child.jpg"]',parent_images:'["parent.jpg"]',parent_image_url:null,specs:{color:'Preto'},price_retail:100000};
 const context={fastify:{get:(...args)=>context.handler=args.at(-1)},pool:{query:async sql=>{query=sql;return [[row]];}},modelBlueprintSelectSql:()=> 'NULL AS blueprint_image_url',comboStockSql:()=> 'stock_quantity',normalizeProductSpecsRam:x=>x};
 vm.runInNewContext(block(source,'function productFamilyNameSelectSql(','\n}'),context);
 vm.runInNewContext(block(source,"fastify.get('/products/:id',"),context);
 const result=await context.handler({params:{id:'child'}},{code(){throw Error('Unexpected failure');}});
 assert.match(query,/AS parent_images/);assert.match(query,/AS parent_image_url/);assert.match(query,/family_parent.id.*products.parent_id/);
 assert.deepEqual(Array.from(result.images),['child.jpg']);assert.equal(result.price_retail,100000);
 assert.deepEqual(resolveProductFamilyImages(result),['parent.jpg']);
 assert.deepEqual(resolveProductFamilyImages(result,[],true,{parentFirst:true}),['parent.jpg']);
 assert.deepEqual(resolveProductFamilyImages({...result,parent_images:[],parent_image_url:null}),['child.jpg']);
 assert.deepEqual(resolveProductFamilyImages({...result,parent_images:null,parent_image_url:'cover.jpg'}),['cover.jpg']);
});
