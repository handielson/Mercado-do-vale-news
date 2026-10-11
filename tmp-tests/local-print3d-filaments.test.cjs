'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {randomUUID}=require('node:crypto');
const {createLocalCatalogPreviewServer,isLocalCatalogPreviewPath}=require('../services/localCatalogPreviewServer.cjs');
test('rascunho salva degradê e só permite aprovação quando a API central suporta as cores combinadas', async t => {
  const app=require('fastify')();t.after(()=>app.close());
  const {registerLocalFilaments}=require('../services/localPrint3dFilaments.cjs');
  let state={};let supported=false;const remoteWrites=[];
  const requestRemote=async(route,auth,options={})=>{
    if(options.method==='POST')remoteWrites.push(route);
    if(route==='/admin/preferences/print3d.cost.v1')return{value:{filaments:[]}};
    if(route==='/brands')return[{name:'Sunlu',active:1}];
    if(route==='/table-data/colors?limit=200&offset=0')return{rows:[{name:'Azul',active:1},{name:'Preto',active:1},{name:'Branco',active:1}]};
    if(route==='/admin/print3d/material-types')return{materials:['PLA']};
    if(route==='/admin/print3d/filaments/status')return{approval:true,stockEnabled:true,...(supported?{colorModes:['single','gradient']}:{})};
    if(route==='/admin/print3d/filaments/approve')return{approved:true};
    throw Error('Unexpected route '+route);
  };
  registerLocalFilaments({app,store:{read:async()=>structuredClone(state),write:async next=>{state=next;}},serialize:work=>work(),requestRemote});
  const empty=(await app.inject('/admin/print3d/filaments')).json();
  const input={id:'gradient',brand:'Sunlu',material:'PLA',colorMode:'gradient',colorNames:['Preto','Branco','Azul'],costPerKgCents:9000};
  const saved=await app.inject({method:'POST',url:'/admin/print3d/filaments',payload:{version:empty.version,filament:input}});
  assert.equal(saved.statusCode,200);
  assert.deepEqual(state.filamentDraft.filaments[0].colorNames,['Azul','Branco','Preto']);assert.deepEqual(remoteWrites,[]);
  const blocked=await app.inject({method:'POST',url:'/admin/print3d/filaments/approve',payload:{}});
  assert.equal(blocked.statusCode,503);assert.match(blocked.json().message || blocked.json().error,/degradê/);assert.deepEqual(remoteWrites,[]);
  assert(state.filamentDraft);
  supported=true;
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/filaments/approve',payload:{}})).statusCode,200);
  assert.deepEqual(remoteWrites,['/admin/print3d/filaments/approve']);assert.equal(state.filamentDraft,undefined);
});
test('cadastro, custos e movimentos locais não escrevem na API central; aprovação exige capacidade publicada',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mdv-filaments-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const writes=[];
  const settings={filaments:[],supplies:[],printerWatts:100,energyCentsPerKwh:100,machineCentsPerHour:100,laborCentsPerHour:2000,packagingCentsPerPiece:0,taxPercent:0};
  let supported=false;let committed=[];let failCostsOnce=false;
  const fetchImpl=async (url,options)=>{
    const route=new URL(url).pathname;
    if ((options.method||'GET')!=='GET') writes.push(route);
    if (!options.headers.authorization && route.startsWith('/admin/print3d/')) return new Response(JSON.stringify({error:'admin required'}),{status:401});
    let value;
    if (route==='/admin/print3d/status') value={enabled:false};
    else if (route==='/admin/preferences/print3d.cost.v1') {
      if (options.method==='PATCH') { if (failCostsOnce) { failCostsOnce=false;return new Response('{}',{status:503}); } Object.assign(settings,JSON.parse(options.body).value); }
      value={value:settings};
    }
    else if (route==='/brands') value=[{name:'Sunlu',active:1}];
    else if (route==='/table-data/colors') {
      assert.equal(new URL(url).searchParams.get('limit'),'200');
      value={rows:[{name:'Branco',active:1},{name:'Preto',active:1},{name:'Inativa',active:0}]};
    }
    else if (route==='/admin/print3d/material-types') value={materials:['PETG','PLA']};
    else if (route==='/admin/print3d/filaments/stock') {
      if (!supported) return new Response('{}',{status:404});
      value={enabled:true,balances:committed.length?[{filament_id:'petg-white',quantity_grams:1000}]:[],movements:committed};
    }
    else if (route==='/admin/print3d/materials') return new Response('{}',{status:503});
    else if (route==='/admin/print3d/filaments/status') value={approval:true,stockEnabled:supported};
    else if (route==='/admin/print3d/filaments/approve') { const body=JSON.parse(options.body);settings.filaments=body.filaments;committed=body.movements.map(m=>({id:m.idempotency_key,movement_key:m.idempotency_key,filament_id:m.filament_id,quantity_delta_grams:m.quantity_grams,reason:m.reason,note:m.note,created_at:m.created_at}));value={approved:true}; }
    else throw Error('Unexpected route '+route);
    return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
  };
  const server=createLocalCatalogPreviewServer({port:0,draftFile:path.join(dir,'draft.json'),fetchImpl});await server.start();const {port}=server.server.address();t.after(()=>server.close());
  const call=async(route,method='GET',body,auth=true)=>fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{...(auth?{authorization:'Bearer admin'}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.equal((await call('/admin/print3d/filaments','GET',undefined,false)).status,401);
  const empty=await(await call('/admin/print3d/filaments')).json();
  assert.deepEqual(empty.references.colors,['Branco','Preto']);
  const record={id:'petg-white',brand:'Sunlu',material:'PETG',color:'Branco',costPerKgCents:9000};
  assert.equal((await call('/admin/print3d/filaments','POST',{version:empty.version,filament:record})).status,200);
  const {filamentPurchaseNote}=await import('../utils/print3dPurchaseChannel.mjs');
  const body={filament_id:record.id,idempotency_key:randomUUID(),expected_grams:0,quantity_grams:1000,reason:'receipt',note:filamentPurchaseNote({reason:'receipt',note:'Pedido teste local'},'Outro','Fornecedor teste')};
  assert.equal((await call('/admin/print3d/filaments/movements','POST',body)).status,200);
  assert.equal((await call('/admin/print3d/filaments/movements','POST',body)).status,200);
  const stock=await(await call('/admin/print3d/filaments/stock')).json();assert.equal(stock.balances[0].quantity_grams,1000);assert.equal(stock.movements.length,1);
  assert.equal(stock.movements[0].note,'Canal de compra: Fornecedor teste | Referência: Pedido teste local');
  const config=await(await call('/admin/preferences/print3d.cost.v1')).json();assert.equal(config.value.filaments[0].spoolCostCents,9000);
  assert.equal((await call('/admin/preferences/print3d.cost.v1','PATCH',{value:config.value})).status,200);
  assert.deepEqual(writes,[]);
  assert.equal((await call('/admin/print3d/filaments/approve','POST',{})).status,503);assert.deepEqual(writes,[]);
  // Inspect recoverable on-disk draft; actual central data was not modified.
  const state=JSON.parse(await fs.readFile(path.join(dir,'draft.json'),'utf8'));assert.equal(state.filamentDraft.movements.length,1);assert.equal(state.filamentDraft.filaments[0].id,record.id);
  supported=true;failCostsOnce=true;
  // Catalog/stock committed but tariff response failed: draft stays recoverable,
  // balance does not double count the committed receipt, retry remains safe.
  assert.equal((await call('/admin/print3d/filaments/approve','POST',{})).status,503);
  const afterFailure=await(await call('/admin/print3d/filaments/stock')).json();assert.equal(afterFailure.balances[0].quantity_grams,1000);assert.equal(afterFailure.movements.length,1);
  assert.equal((await call('/admin/print3d/filaments/approve','POST',{})).status,200);
  const approved=JSON.parse(await fs.readFile(path.join(dir,'draft.json'),'utf8'));assert.equal(approved.filamentDraft,undefined);assert.equal(approved.filamentApprovedArchives.length,1);assert.equal(committed.length,1);
  assert.equal(committed[0].note,body.note);
  assert.equal(isLocalCatalogPreviewPath('/admin/print3d/filaments/movements','POST'),true);
  assert.equal(isLocalCatalogPreviewPath('/admin/print3d/production/id/progress','POST'),false);
});

test('catálogo central novo permanece disponível ao lado do rascunho antigo, sem rebase ou escrita',async t=>{
  const app=require('fastify')();t.after(()=>app.close());
  const {registerLocalFilaments}=require('../services/localPrint3dFilaments.cjs');
  const local={id:'black',name:'PETG',color:'Preto',spoolGrams:1000,spoolCostCents:5750};
  const base={filaments:[{...local,spoolCostCents:5650},{id:'white',name:'PLA',color:'Branco',spoolGrams:1000,spoolCostCents:7000}]};
  const state={filamentDraft:{base_version:'original',filaments:[local],movements:[],base_costs:{}}};
  const original=JSON.stringify(state);
  registerLocalFilaments({app,store:{read:async()=>state,write:async()=>assert.fail('Read mutated draft')},serialize:work=>work(),requestRemote:async route=>{
    assert.equal(route,'/admin/preferences/print3d.cost.v1');return{value:base};
  }});
  const result=(await app.inject('/admin/preferences/print3d.cost.v1')).json();
  assert.equal(result.value.filaments.length,2);
  assert.equal(result.value.filaments[0].spoolCostCents,5750);
  assert.equal(result.value.filaments[1].id,'white');
  assert.equal(JSON.stringify(state),original);
  assert.equal(base.filaments[0].spoolCostCents,5650);
});

test('listas reutilizam paginação do banco de cores e atualização busca a cor nova sem cache',async t=>{
  const app=require('fastify')();t.after(()=>app.close());
  const {registerLocalFilaments}=require('../services/localPrint3dFilaments.cjs');
  let state={};let newColor=false;const reads=[];
  registerLocalFilaments({app,store:{read:async()=>state,write:async next=>{state=next;}},serialize:work=>work(),requestRemote:async(route)=>{
    reads.push(route);
    if(route==='/admin/preferences/print3d.cost.v1')return{value:{filaments:[]}};
    if(route==='/brands')return[{name:'Sunlu',active:1}];
    if(route==='/admin/print3d/material-types')return{materials:['PETG']};
    if(route==='/table-data/colors?limit=200&offset=0')return{data:Array.from({length:200},(_,i)=>({name:'Cor '+i,active:1}))};
    if(route==='/table-data/colors?limit=200&offset=200')return{items:newColor?[{name:'Translucido',active:1}]:[]};
    throw Error('Unexpected route '+route);
  }});
  const first=(await app.inject('/admin/print3d/filaments')).json();assert.equal(first.references.colors.length,200);
  newColor=true;const updated=(await app.inject('/admin/print3d/filaments')).json();assert.equal(updated.references.colors.length,201);assert(updated.references.colors.includes('Translucido'));
  assert.equal(reads.filter(route=>route==='/table-data/colors?limit=200&offset=200').length,2);
});

test('cadastro local salva entrada junto, sem escrita central ou alteração parcial',async t=>{
  const app=require('fastify')();t.after(()=>app.close());
  const {registerLocalFilaments}=require('../services/localPrint3dFilaments.cjs');
  const {version}=require('../services/print3dFilaments.cjs');
  let state={};let writes=0;
  registerLocalFilaments({app,store:{read:async()=>state,write:async next=>{state=next;writes++;}},serialize:work=>work(),requestRemote:async(route,auth,options)=>{
    assert.equal(options,undefined);
    if(route==='/admin/preferences/print3d.cost.v1')return{value:{filaments:[]}};
    if(route==='/brands')return[{name:'Sunlu',active:1}];
    if(route==='/admin/print3d/material-types')return{materials:['PETG']};
    if(route.startsWith('/table-data/colors?'))return{rows:[{name:'Preto',active:1}]};
    if(route==='/admin/print3d/filaments/stock')return{enabled:false,balances:[],movements:[]};
    throw Error('Unexpected route '+route);
  }});
  const filament={id:'petg-black',brand:'Sunlu',material:'PETG',color:'Preto',costPerKgCents:5750};
  const receipt={filament_id:filament.id,quantity_grams:5000,expected_grams:0,idempotency_key:randomUUID(),reason:'receipt',note:'Canal de compra: Shopee'};
  const payload={filament,version:version([]),receipt};
  const save=body=>app.inject({method:'POST',url:'/admin/print3d/filaments',payload:body});
  assert.equal((await save({...payload,receipt:{...receipt,filament_id:'wrong'}})).statusCode,400);
  assert.deepEqual(state,{});assert.equal(writes,0);
  assert.equal((await save({...payload,filament:{...filament,brand:'Unknown'}})).statusCode,400);
  assert.deepEqual(state,{});assert.equal(writes,0);
  assert.equal((await save(payload)).statusCode,200);assert.equal(writes,1);
  assert.equal(state.filamentDraft.filaments.length,1);assert.equal(state.filamentDraft.movements.length,1);
  const stock=(await app.inject('/admin/print3d/filaments/stock')).json();
  assert.equal(stock.balances[0].quantity_grams,5000);assert.equal(stock.movements[0].note,receipt.note);
  assert.equal((await save(payload)).statusCode,409);assert.equal(writes,1);
  assert.equal(state.filamentDraft.movements.length,1);
  const move=body=>app.inject({method:'POST',url:'/admin/print3d/filaments/movements',payload:body});
  const used={...receipt,idempotency_key:randomUUID(),reason:'adjustment',action:'used',quantity_grams:-250,expected_grams:5000,note:'Teste'};
  assert.equal((await move(used)).statusCode,200);assert.equal(writes,2);
  const deactivate={...receipt,idempotency_key:randomUUID(),reason:'adjustment',action:'deactivate',quantity_grams:-4750,expected_grams:4750,note:'Retirar restante'};
  assert.equal((await move({...deactivate,quantity_grams:-1})).statusCode,400);
  assert.equal(state.filamentDraft.filaments[0].active,true);assert.equal(writes,2);
  assert.equal((await move(deactivate)).statusCode,200);assert.equal(writes,3);
  assert.equal(state.filamentDraft.filaments[0].active,false);
  assert.equal((await move(deactivate)).statusCode,200);assert.equal(writes,3);
  const emptied=(await app.inject('/admin/print3d/filaments/stock')).json();assert.equal(emptied.balances[0].quantity_grams,0);assert.equal(emptied.movements.length,3);
  assert.equal((await move({...used,idempotency_key:randomUUID(),expected_grams:0})).statusCode,409);
});
