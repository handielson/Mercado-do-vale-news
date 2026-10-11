const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const page=fs.readFileSync('pages/admin/products/ProductFormPage.tsx','utf8');
const form=fs.readFileSync('components/products/ProductForm.tsx','utf8');
test('failed create propagates to form, without navigating or reporting success',async()=>{
 const snippet=page.slice(page.indexOf('    const handleSubmit = async'),page.indexOf('    const handleBatchComplete'))+'\nexports.submit=handleSubmit;';
 const notices=[],loading=[];
 const ctx={exports:{},isEditMode:false,id:null,console:{error(){}},productService:{create:async()=>{throw new Error('Model ID é obrigatório');}},setIsLoading:v=>loading.push(v),toast:{error:v=>notices.push(v),success:v=>notices.push(v)}};
 vm.runInNewContext(ts.transpileModule(snippet,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 await assert.rejects(ctx.exports.submit({name:'Mini Esqueleto'}),/Model ID/);
 assert.deepEqual(notices,[]);assert.deepEqual(loading,[true,false]);
 const save=form.indexOf('const savedProduct = !initialData?.id && singleSaveCheckpoint.current?.id');
 const confirmed=form.indexOf('if (!savedProduct?.id) throw',save);
 const success=form.indexOf("toast.success('Produto cadastrado com sucesso!')",save);
 const navigate=form.indexOf('onBatchComplete?.',save);
 assert(save>=0 && save<confirmed && confirmed<success && success<navigate);
 assert.match(form,/toast.error\(error instanceof Error \? error.message : 'Erro ao salvar produto/);
});
test('SKU preview uses backend generator, stays separate from submitted SKU, and files are discoverable for parents',()=>{
 const basic=fs.readFileSync('components/products/sections/ProductBasicInfo.tsx','utf8');
 assert.match(basic,/import \{ productSkuPrefix, nextProductSku \} from '@mdv\/product-sku'/);
 assert.match(basic,/setSkuPreview\(nextProductSku\(typedName, skus\)\)/);
 const effect=basic.slice(basic.indexOf('const typedName'),basic.indexOf('const [parentSearch'));
 assert(!effect.includes("setValue('sku'"));
 assert.match(form,/\['production', 'Arquivos e produção 3D'\]/);
 assert.match(form,/!variationDraftMode && isParentProduct && <div id="product-variations-section"[\s\S]*?<ProductFamilyEditor/);
 assert.match(fs.readFileSync('components/products/familyRegistration.js','utf8'),/buildProductVariationPrefill\(parent\)/);
});
test('child prefill inherits parent content, but never its SKU or marketplace identity', async()=>{
 const {buildProductVariationPrefill}=await import('../services/productClonePrefill.js');
 const parent={id:'parent',sku:'MINI0001',name:'Mini Esqueleto - MINI0001',is_parent:true,is_print3d:true,description:'<h2>Original</h2>',category_id:'key',bling_id:12,shopee_item_id:22,slug:'mini',images:['photo'],specs:{material:'PLA'},stock_quantity:10};
 const child=buildProductVariationPrefill(parent);
 assert.equal(child.id,undefined);assert.equal(child.parent_id,'parent');assert.equal(child.sku,'');assert.equal(child.name,'Mini Esqueleto');assert.equal(child.is_parent,false);assert.equal(child.description,parent.description);assert.equal(child.stock_quantity,0);
 assert.equal(child.bling_id,undefined);assert.equal(child.shopee_item_id,undefined);assert.equal(child.slug,undefined);
 assert.deepEqual(child.images,parent.images);assert.equal(parent.is_parent,true);
});
test('parent variations are the last stage, while standalone children retain production and prices',()=>{
 const nav=form.slice(form.indexOf('<nav id='),form.indexOf('</nav>'));
 const start=nav.indexOf('{([')+2,end=nav.indexOf('] as const).map')+1;
 assert(start>1 && end>start);
 const expression=nav.slice(start,end);
 const sections=(isParentProduct,isPrint3d,variationDraftMode=false)=>{
  const ctx={exports:{},isParentProduct,isPrint3d,variationDraftMode};
  vm.runInNewContext(ts.transpileModule('exports.sections='+expression,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  return Array.from(ctx.exports.sections,section=>section[0]);
 };
 for(const print3d of [true,false]) assert.deepEqual(sections(true,print3d),['basic','specs','media','channels','fiscal','variations']);
 assert.deepEqual(sections(false,true),['basic','specs','media','channels','production','commercial','fiscal']);
 assert(!sections(false,true,true).includes('variations'));
 const basic=form.slice(form.indexOf('id="product-basic-section"'),form.indexOf('{/* 1. TIPO DE PRODUTO */}'));
 assert(!basic.includes('<ProductFamilyEditor'));
 assert.match(form,/id="product-variations-section" className=\{activeSection === 'variations'/);
 assert.match(form,/activeSection === \(isParentProduct \? 'variations' : 'production'\)/);
 assert.match(form,/type="button" onClick=\{\(\) => selectSection\('variations'\)\}/);
});
