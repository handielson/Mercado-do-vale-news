import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { familyChildPayload, productUnitCondition, saveFamilyRegistration, buildAttributeVariationDraft, validateFamilyIdentifiers } from '../components/products/familyRegistration.js';
import { stripModelOwnedSpecs } from '../services/smartphoneModelSpecs.mjs';

test('descrição individual é explícita; herança das demais informações acompanha o pai ao salvar', () => {
  const parent={id:'parent',sku:'MINI0001',name:'Mini',description:'Pai',video_url:'parent-video',price_retail:2500,dimensions:{height_cm:4},specs:{condition:'new'}};
  const child=buildAttributeVariationDraft(parent,[{key:'color',value:'Branco'}],[],{listing:{description:'<h2>Individual</h2>',price_retail:1200,dimensions:{height_cm:2},specs:{_inherit_parent_description:false,_inherit_parent_fields:['price_retail']}}});
  const payload=familyChildPayload(parent,child);
  assert.equal(payload.description,'<h2>Individual</h2>');assert.equal(payload.price_retail,2500);assert.equal(payload.dimensions.height_cm,2);assert.equal(payload.specs.color,'Branco');
  assert.equal(familyChildPayload(parent,{...child,specs:{...child.specs,_inherit_parent_video:true}}).video_url,'parent-video');
  assert.throws(()=>buildAttributeVariationDraft(parent,[{key:'color',value:'Azul'}],[],{sku:'OUTR0001'}),/SKU do pai/);
});

test('vídeo do Synology é consultado pelo SKU definitivo e gravado no filho confirmado', async () => {
  const checks=[],updates=[];
  const checkpoint={parent:null,children:{}};
  await saveFamilyRegistration({name:'Pai'},[{key:'x',data:{name:'Filho',sku:''},inheritImages:false}],checkpoint,{
    create:async data=>({...data,id:data.parent_id?'child':'parent',sku:data.parent_id?'MINI0001-01':'MINI0001'}),
    checkVideo:async sku=>{checks.push(sku);return {exists:true,url:'https://example.test/MINI0001-01.mp4'};},
    update:async(id,data)=>{updates.push({id,...data});return {id,...data};}
  });
  assert.deepEqual(checks,['MINI0001-01']);assert.equal(updates[0].id,'child');assert.equal(checkpoint.children.x.video_url,'https://example.test/MINI0001-01.mp4');
});

test('mídia escolhida junto dos atributos permanece separada por filho ao salvar', async () => {
  const parent={name:'Mini Esqueleto',images:['parent-photo'],video_url:'parent-video',description:'Descrição do pai'};
  const white=buildAttributeVariationDraft(parent,[{key:'color',value:'Branco'}],[],{inheritImages:false,images:['white-photo'],videoUrl:' white-video '});
  const blue=buildAttributeVariationDraft(parent,[{key:'color',value:'Azul'}]);
  assert.deepEqual(white.images,['white-photo']); assert.equal(white.video_url,'white-video');
  assert.deepEqual(blue.images,['parent-photo']); assert.equal(blue.video_url,null);
  white.images.push('second-white-photo'); assert.deepEqual(parent.images,['parent-photo']);
  const calls=[];
  await saveFamilyRegistration(parent,[{key:'white',data:white,inheritImages:false},{key:'blue',data:blue,inheritImages:true}],{parent:null,children:{}},{create:async data=>{calls.push(data);return {...data,id:data.name};}});
  assert.deepEqual(calls[1].images,['white-photo','second-white-photo']); assert.equal(calls[1].video_url,'white-video');
  assert.deepEqual(calls[2].images,['parent-photo']); assert.equal(calls[2].video_url,null);
  assert.equal(calls[1].description,null); assert.equal(parent.video_url,'parent-video');
});

test('nova variação e filhos existentes têm mídia inline e salvamento aguarda uploads', () => {
  const editor=fs.readFileSync('components/products/ProductFamilyEditor.tsx','utf8');
  assert.equal((editor.match(/<VariationMedia\b/g)||[]).length,2);
  assert.match(editor,/disabled=\{disabled \|\| busy\}/);
  const form=fs.readFileSync('components/products/ProductForm.tsx','utf8');
  assert.match(form,/if \(familyMediaBusy\)/); assert.match(form,/onBusyChange=\{setFamilyMediaBusy\}/);
});

test('cada filho mantém SKU e EAN próprios; o pai não empresta seus códigos', async () => {
  const parent = {name:'Mini Esqueleto',sku:'PAI0001',eans:['7890000000017']};
  const draft = buildAttributeVariationDraft(parent,[{key:'color',value:'Branco'}],[],{sku:' PAI0001-01 ',eans:['7890000000024','']});
  assert.equal(draft.sku,'PAI0001-01'); assert.deepEqual(draft.eans,['7890000000024']);
  const automatic = buildAttributeVariationDraft(parent,[{key:'color',value:'Azul'}]);
  assert.equal(automatic.sku,''); assert.deepEqual(automatic.eans,[]);
  const calls=[];
  await saveFamilyRegistration(parent,[{key:'white',data:draft,inheritImages:true}],{parent:null,children:{}},{create:async data=>{calls.push(data);return {...data,id:data.sku};}});
  assert.equal(calls[1].sku,'PAI0001-01'); assert.deepEqual(calls[1].eans,['7890000000024']);
  assert.deepEqual(parent.eans,['7890000000017']);
  const source=fs.readFileSync('components/products/ProductFamilyEditor.tsx','utf8');
  assert.match(source,/readOnly=\{Boolean\(row.data.id\)\}/);
  assert.match(source,/EANInput label="EAN da variação"/);
});
test('códigos duplicados na família ou EAN incompleto são rejeitados antes de gravar', async () => {
  const parent={name:'Pai',sku:'PAI0001'};
  assert.throws(()=>validateFamilyIdentifiers(parent,[{data:{sku:'pai0001'}}]),/SKU próprio/);
  assert.throws(()=>validateFamilyIdentifiers(parent,[{data:{sku:'A'}},{data:{sku:'a'}}]),/SKU próprio/);
  assert.throws(()=>validateFamilyIdentifiers(parent,[{data:{eans:['123']}}]),/13 dígitos/);
  const rows=[{data:{eans:['7890000000024']}},{data:{eans:['7890000000024']}}];
  let writes=0;
  await assert.rejects(saveFamilyRegistration(parent,rows,{},{create:async()=>{writes++;}}),/EAN não pode/);
  assert.equal(writes,0);
});

test('adicionar variação usa atributos sem abrir um cadastro completo', () => {
  const parent = {name:'Mini Esqueleto - MINI0001',sku:'MINI0001',is_print3d:true,description:'<h2>Pai</h2>',images:['pai'],specs:{unit:'UN'}};
  const draft = buildAttributeVariationDraft(parent,[{key:'color',value:' Branco '},{key:'material',value:'PLA'}]);
  assert.equal(draft.name,'Mini Esqueleto - Branco / PLA');
  assert.equal(draft.sku,''); assert.equal(draft.id,undefined);
  assert.equal(draft.specs.color,'Branco'); assert.equal(draft.specs.material,'PLA'); assert.equal(draft.specs.unit,'UN');
  assert.equal(parent.specs.color,undefined); assert.deepEqual(draft.images,['pai']);
  const child = familyChildPayload({...parent,id:'pai'},draft);
  assert.equal(child.description,null); assert.equal(child.parent_id,'pai'); assert.equal(child.specs.color,'Branco');
  const editor = fs.readFileSync('components/products/ProductFamilyEditor.tsx','utf8');
  const add = editor.slice(editor.indexOf('const add ='),editor.indexOf('const confirmAttributes'));
  assert.ok(!add.includes('setEditing'));
  assert.match(editor,/Atributos da nova variação/); assert.match(editor,/Incluir variação na família/);
});
test('atributos vazios, repetidos e combinações duplicadas não criam filhos', () => {
  const parent={name:'Mini Esqueleto'};
  assert.throws(()=>buildAttributeVariationDraft(parent,[]));
  assert.throws(()=>buildAttributeVariationDraft(parent,[{key:'color',value:''}]));
  assert.throws(()=>buildAttributeVariationDraft(parent,[{key:'color',value:'Azul'},{key:'color',value:'Verde'}]));
  assert.throws(()=>buildAttributeVariationDraft(parent,[{key:'not-a-field',value:'x'}]));
  assert.throws(()=>buildAttributeVariationDraft(parent,[{key:'color',value:'azul'}],[{data:{specs:{color:' AZUL '}}}]),/Já existe/);
});

test('child preserves its SKU/details, inherits parent description authority and supports own photos', () => {
  const parent = { id:'p', sku:'PAI0001', description:'<h2>Pai</h2>', images:['parent'], is_print3d:true, specs:{ material:'PLA' } };
  const child = { sku:'FILH0002', images:['child'], specs:{ color:'Azul', condition:'used' }, dimensions:{ height_cm:3 } };
  const payload = familyChildPayload(parent, child, false);
  assert.equal(payload.sku,'FILH0002'); assert.equal(payload.parent_id,'p'); assert.equal(payload.description,null);
  assert.deepEqual(payload.images,['child']); assert.equal(payload.specs.material,'PLA'); assert.equal(payload.specs.color,'Azul');
  assert.equal(payload.print3d_preorder_enabled,true); assert.equal(payload.print3d_preorder_limit,null); assert.equal(payload.production_days,null);
  assert.deepEqual(familyChildPayload(parent,child,true).images,['parent']); assert.deepEqual(child.images,['child']);
});
test('partial save retries confirmed parent/children without creating duplicates', async () => {
  let fails=true; const created=[],updated=[];
  const api={create:async data=>{if(data.name==='B' && fails) throw Error('offline');created.push(data.name);return {...data,id:data.name};},update:async(id,data)=>{updated.push(id);return {...data,id};}};
  const checkpoint={parent:null,children:{}};
  const rows=['A','B'].map(name=>({key:name,data:{name,sku:'',specs:{}},inheritImages:true}));
  await assert.rejects(saveFamilyRegistration({name:'Pai'},rows,checkpoint,api),/Família salva.*B.*offline/);
  assert.deepEqual(created,['Pai','A']); fails=false;
  await saveFamilyRegistration({name:'Pai'},rows,checkpoint,api);
  assert.deepEqual(created,['Pai','A','B']);assert.deepEqual(updated,['Pai','A']);
});
test('used serialized child creates a physical used unit, once across a confirmed retry', async () => {
  const calls=[];const checkpoint={parent:null,children:{}};
  const api={create:async data=>({...data,id:data.name}),update:async(id,data)=>({...data,id}),createUnit:async data=>{calls.push(data);return {...data,id:'unit'};}};
  const rows=[{key:'x',data:{name:'Filho',specs:{condition:'USADO',serial:'TEST-ONLY'}},inheritImages:false}];
  await saveFamilyRegistration({name:'Pai'},rows,checkpoint,api); await saveFamilyRegistration({name:'Pai'},rows,checkpoint,api);
  assert.equal(calls.length,1);assert.equal(calls[0].condition,'used');assert.equal(calls[0].serial_number,'TEST-ONLY');
  assert.equal(checkpoint.children.x.specs.serial,undefined); assert.equal(rows[0].data.specs.serial,'TEST-ONLY');
});
test('main and batch use the selected condition; draft capture never saves products', () => {
  assert.equal(productUnitCondition({condition:'USADO'}),'used');assert.equal(productUnitCondition({condition:'open_box'}),'open_box');
  const form=fs.readFileSync('components/products/ProductForm.tsx','utf8');
  assert.match(form,/condition: productUnitCondition\(unitItem.specs\)/);assert.match(form,/condition: productUnitCondition\(mergedData.specs\)/);
  assert.match(form,/if \(variationDraftMode\) \{[\s\S]*?await onSubmit\(mergedData\);\s*return;/);
  assert.match(form,/event.stopPropagation\(\)/);
  const specs = stripModelOwnedSpecs({ condition:'used', unit:'UN', production:'third_party', chipset:'model owned' });
  assert.equal(specs.condition,'used'); assert.equal(specs.unit,'UN'); assert.equal(specs.production,'third_party'); assert.equal(specs.chipset,undefined);
});

test('failed unit save remains pending after UI refreshes the confirmed child ID', async () => {
  const checkpoint={parent:null,children:{}};let fails=true,creates=0,units=0;
  const api={create:async data=>{creates++;return {...data,id:data.name};},update:async(id,data)=>({...data,id}),createUnit:async data=>{if(fails) throw Error('unit unavailable');units++;return {...data,id:'unit'};}};
  const row={key:'x',data:{name:'Filho',specs:{serial:'FIXTURE',condition:'used'}},inheritImages:false};
  await assert.rejects(saveFamilyRegistration({name:'Pai'},[row],checkpoint,api),/unit unavailable/);
  row.data.id=checkpoint.children.x.id;fails=false;
  await saveFamilyRegistration({name:'Pai'},[row],checkpoint,api);
  assert.equal(creates,2);assert.equal(units,1);assert.equal(checkpoint.units.x.condition,'used');
});
