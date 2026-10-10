const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function load(file,requireImpl){const context={exports:{},require:requireImpl};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);return context.exports;}
const core=load('components/products/sections/categorySpecFieldCore.js',()=>assert.fail('Unexpected import'));
const metadata=load('components/products/sections/fieldMetadata.ts',()=>core);
const modelSpecs=load('services/smartphoneModelSpecs.mjs',()=>assert.fail('Unexpected model spec import'));
const measurements=load('utils/print3dMeasurements.js',()=>assert.fail('Unexpected measurement import'));
function render(isPrint3d,categoryConfig,customFields=[],measurementValues={}){
 const component=load('components/products/sections/ProductSpecifications.tsx',name=>{
  if(name==='react')return React;
  if(name.endsWith('/categorySpecFieldCore.js'))return core;
  if(name.endsWith('/fieldMetadata'))return metadata;
  if(name.endsWith('/smartphoneModelSpecs.mjs'))return modelSpecs;
  if(name.endsWith('/print3dMeasurements.js'))return measurements;
  if(name.endsWith('/MaterialSelect'))return {MaterialSelect:props=>React.createElement('select',{'aria-label':props.label,value:props.value,onChange:()=>{}},React.createElement('option',{value:props.value},props.value))};
  if(name.includes('useEnrichedCustomFields'))return {useEnrichedCustomFields:()=>({fields:customFields,loading:false})};
  if(name.includes('serializedBatch'))return {shouldAddSerializedFieldToBatchOnEnter:()=>false};
  if(name.includes('vpsApiService'))return {vpsApiService:{}};
  if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});
  if(/IMEIInput|ColorSelect|CapacitySelect|VersionSelect|TableRelationField/.test(name)){
   const key=name.split('/').pop();return {[key]:props=>React.createElement('input',{'aria-label':props.label||key,value:props.value||'',readOnly:true})};
  }
  assert.fail('Unexpected import: '+name);
 });
 const values={'is_print3d':isPrint3d,'specs.material':'PETG','specs.size':'Grande','specs.finish':'Fosco','specs.color':'Preto',...measurementValues};
 return renderToStaticMarkup(React.createElement(component.ProductSpecifications,{categoryConfig,watch:key=>values[key],setValue:()=>{},errors:{}}));
}
test('3D renders editable canonical attributes and hides phone fields even for a phone category',()=>{
 const html=render(true,{__category_name:'Smartphones',imei1:'required',imei2:'required',serial:'required',version:'required',battery_health:'required'});
 assert.match(html,/<select aria-label="Material"><option value="PETG" selected="">PETG<\/option><\/select>/);
 assert.match(html,/id="field-finish"[^>]*value="Fosco"/);
 assert(!html.includes('id="field-size"'));
 for(const {key,label,unit} of measurements.PRINT3D_MEASUREMENT_FIELDS){
  assert.match(html,new RegExp(`id="field-${key}" type="number" min="0" step="0.001"`));
  assert(html.includes(`${label} (${unit})`));
 }
 assert.match(html,/Tamanho antigo preservado: Grande/);
 assert(!phoneHasMeasurements(render(false,{__category_name:'Smartphones'})));
 assert.match(html,/ColorSelect/);
 for(const label of ['IMEI 1','IMEI 2','Serial','Armazenamento','Memória RAM','Saúde Bateria'])assert(!html.includes(label),label);
 const phone=render(false,{__category_name:'Smartphones',imei1:'required',imei2:'required',serial:'required'});
 for(const label of ['IMEI 1','IMEI 2','Serial','Armazenamento','Memória RAM'])assert(phone.includes(label),label);
 assert(!phone.includes('field-material'));
});
test('3D respects category visibility and avoids duplicate custom attributes',()=>{
 const html=render(true,{material:'off',size:'required',custom_fields:[{key:'finish',requirement:'optional'}]},[{id:'finish',key:'finish',name:'Acabamento especial',type:'text',requirement:'optional'}]);
 assert(!html.includes('aria-label="Material"'));
 assert.equal((html.match(/id="field-dimensions.height_cm"/g)||[]).length,1);
 assert(!html.includes('id="field-size"'));
 assert(!html.includes('id="field-finish"'));
 assert.match(html,/Acabamento especial/);
});
function phoneHasMeasurements(html){return html.includes('Medidas do produto');}
test('existing cm dimensions render as mm in the actual 3D inputs and announcement preview',()=>{
 const html=render(true,{},[],{'dimensions.height_cm':3.5,'dimensions.width_cm':2,'dimensions.depth_cm':1.2,'weight_kg':0.012,dimensions:{height_cm:3.5,width_cm:2,depth_cm:1.2}});
 for(const [key,value] of [['dimensions.height_cm',35],['dimensions.width_cm',20],['dimensions.depth_cm',12],['weight_kg',0.012]]){
  assert.match(html,new RegExp(`id="field-${key}"[^>]*value="${value}"`));
 }
 for(const label of ['Altura (mm)','Largura (mm)','Profundidade (mm)','Peso (kg)'])assert(html.includes(label));
 assert(html.includes('Altura: 35 mm • Largura: 20 mm • Profundidade: 12 mm'));
 assert(!html.includes('(cm)'));
});
