const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function load(file,requireImpl){const context={exports:{},require:requireImpl};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);return context.exports;}
const core=load('components/products/sections/categorySpecFieldCore.js',()=>assert.fail('Unexpected import'));
const metadata=load('components/products/sections/fieldMetadata.ts',()=>core);
function render(isPrint3d,categoryConfig,customFields=[]){
 const component=load('components/products/sections/ProductSpecifications.tsx',name=>{
  if(name==='react')return React;
  if(name.endsWith('/categorySpecFieldCore.js'))return core;
  if(name.endsWith('/fieldMetadata'))return metadata;
  if(name.includes('useEnrichedCustomFields'))return {useEnrichedCustomFields:()=>({fields:customFields,loading:false})};
  if(name.includes('serializedBatch'))return {shouldAddSerializedFieldToBatchOnEnter:()=>false};
  if(name.includes('vpsApiService'))return {vpsApiService:{}};
  if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
  if(/IMEIInput|ColorSelect|CapacitySelect|VersionSelect|TableRelationField/.test(name)){
   const key=name.split('/').pop();return {[key]:props=>React.createElement('input',{'aria-label':props.label||key,value:props.value||'',readOnly:true})};
  }
  assert.fail('Unexpected import: '+name);
 });
 const values={'is_print3d':isPrint3d,'specs.material':'PETG','specs.size':'Grande','specs.finish':'Fosco','specs.color':'Preto'};
 return renderToStaticMarkup(React.createElement(component.ProductSpecifications,{categoryConfig,watch:key=>values[key],setValue:()=>{},errors:{}}));
}
test('3D renders editable canonical attributes and hides phone fields even for a phone category',()=>{
 const html=render(true,{__category_name:'Smartphones',imei1:'required',imei2:'required',serial:'required',version:'required',battery_health:'required'});
 for(const [key,value] of [['material','PETG'],['size','Grande'],['finish','Fosco']])assert.match(html,new RegExp(`id="field-${key}"[^>]*value="${value}"`));
 assert.match(html,/ColorSelect/);
 for(const label of ['IMEI 1','IMEI 2','Serial','Armazenamento','Memória RAM','Saúde Bateria'])assert(!html.includes(label),label);
 const phone=render(false,{__category_name:'Smartphones',imei1:'required',imei2:'required',serial:'required'});
 for(const label of ['IMEI 1','IMEI 2','Serial','Armazenamento','Memória RAM'])assert(phone.includes(label),label);
 assert(!phone.includes('field-material'));
});
test('3D respects category visibility and avoids duplicate custom attributes',()=>{
 const html=render(true,{material:'off',size:'required',custom_fields:[{key:'finish',requirement:'optional'}]},[{id:'finish',key:'finish',name:'Acabamento especial',type:'text',requirement:'optional'}]);
 assert(!html.includes('field-material'));
 assert.equal((html.match(/id="field-size"/g)||[]).length,1);
 assert(!html.includes('id="field-finish"'));
 assert.match(html,/Acabamento especial/);
});
