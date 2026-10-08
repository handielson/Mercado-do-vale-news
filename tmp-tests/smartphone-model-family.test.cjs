'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {ensureSmartphoneModelFamily}=require('../services/smartphoneModelFamily.cjs');
const model={id:'m',name:'produto teste Redmi',category_id:'cat',category_name:'Smartphones',company_id:'c',brand_name:'Xiaomi',template_values:{ram:'4GB',storage:'128GB',color:'Verde',nfc:'Sim'}};
const child=(id,patch={})=>({id,sku:id,model_id:'m',company_id:'c',parent_id:null,is_parent:0,price_cost:900,price_retail:1200,stock_quantity:1,...patch});
const opts={modelId:'m',companyId:'c',defaultCompanyId:'c'};
function database(rows=[child('a'),child('b')],patch={}) {
  const state={rows:structuredClone(rows),model:{...model,...patch},sql:[],writes:0,tail:Promise.resolve(),failUpdate:false};
  async function transaction(options={}) {
    let unlock,snapshot;
    const query=async(sql,args=[])=>{
      state.sql.push(sql);
      if(sql==='SELECT id FROM models WHERE id=? FOR UPDATE'){
        const previous=state.tail;state.tail=new Promise(r=>{unlock=r;});await previous;
        snapshot=structuredClone(state.rows);return [[state.model?{id:'m'}:undefined].filter(Boolean)];
      }
      if(sql.includes('FROM models m'))return [[state.model]];
      if(sql.includes('FROM products WHERE model_id='))return [structuredClone(state.rows.filter(r=>r.model_id===args[0]).sort((a,b)=>a.id.localeCompare(b.id)))];
      if(sql.includes('FROM products WHERE bling_id='))return [structuredClone(state.rows.filter(r=>r.bling_id===args[0]&&r.is_parent===1))];
      if(sql.includes('FROM products WHERE id='))return [structuredClone(state.rows.filter(r=>r.id===args[0]))];
      if(sql.includes('FROM products WHERE sku='))return [state.rows.filter(r=>r.sku===args[0]).map(r=>({id:r.id}))];
      if(sql.includes('FROM products WHERE parent_id='))return [structuredClone(state.rows.filter(r=>r.parent_id===args[0]))];
      if(sql.startsWith('INSERT INTO products')){
        state.writes++;state.rows.push({id:args[0],name:args[1],sku:args[2],model_id:args[3],company_id:args[4],is_parent:1,parent_id:null,price_retail:0,stock_quantity:0,specs:JSON.parse(args[7])});return [{affectedRows:1}];
      }
      if(sql.startsWith('UPDATE products SET parent_id=')){
        if(state.failUpdate)throw Error('simulated update failure');
        assert.doesNotMatch(sql,/price_|stock_quantity|units/);state.writes++;
        state.rows.find(r=>r.id===args[1]).parent_id=args[0];return [{affectedRows:1}];
      }
      if(sql.startsWith('UPDATE products SET model_id=')){state.writes++;state.rows.find(r=>r.id===args[1]).model_id=args[0];return [{affectedRows:1}];}
      if(sql.startsWith('UPDATE products SET company_id=')){state.writes++;state.rows.find(r=>r.id===args[1]).company_id=args[0];return [{affectedRows:1}];}
      throw Error('Unexpected SQL '+sql);
    };
    try{return await ensureSmartphoneModelFamily({query},{...opts,...options});}
    catch(error){if(snapshot)state.rows=snapshot;throw error;}
    finally{unlock?.();}
  }
  return {state,transaction};
}
test('cria pai uma vez e vincula cores/memorias preservando dados dos filhos',async()=>{
  const db=database();const before=structuredClone(db.state.rows);const r=await db.transaction({productId:'a'});
  assert.equal(r.created,true);assert.equal(r.linked_count,2);
  const parent=db.state.rows.find(p=>p.is_parent);assert.equal(parent.name,model.name);assert.equal(parent.stock_quantity,0);
  assert.equal(parent.specs.nfc,undefined);assert.equal(parent.specs.ram,undefined);assert.equal(parent.specs.color,undefined);
  const {applySmartphoneModelSpecs}=await import('../services/smartphoneModelSpecs.mjs');
  assert.equal(applySmartphoneModelSpecs(parent,model).specs.nfc,'Sim');
  for(const original of before)assert.deepEqual(db.state.rows.find(p=>p.id===original.id),{...original,parent_id:parent.id});
  const second=await db.transaction();assert.equal(second.created,false);assert.equal(second.linked_count,0);assert.equal(db.state.rows.length,3);
});
test('duas confirmacoes simultaneas criam um unico pai',async()=>{
  const db=database();const [a,b]=await Promise.all([db.transaction({productId:'a'}),db.transaction({productId:'b'})]);
  assert.equal(a.parent_id,b.parent_id);assert.equal(db.state.rows.filter(p=>p.is_parent).length,1);
});
test('reutiliza pai local e vincula somente produtos sem pai',async()=>{
  const db=database([child('pai',{is_parent:1}),child('a',{parent_id:'pai'}),child('b')]);
  const r=await db.transaction();assert.equal(r.parent_id,'pai');assert.equal(r.created,false);assert.equal(r.linked_count,1);
});
test('reutiliza pai do Bling sem modelo e preserva vinculos externos',async()=>{
  const db=database([child('pai',{is_parent:1,model_id:null,bling_id:'10'}),child('a',{bling_parent_id:'10',bling_id:'11'})]);
  const r=await db.transaction();assert.equal(r.parent_id,'pai');assert.equal(db.state.rows[0].model_id,'m');
  assert.equal(db.state.rows[1].bling_id,'11');assert.equal(db.state.rows[1].bling_parent_id,'10');
});
test('pai comercial legado prevalece sobre referencias Bling sem filhos locais',async()=>{
  const db=database([child('local',{is_parent:1,company_id:null}),child('bling1',{is_parent:1,bling_id:'10'}),
    child('bling2',{is_parent:1,bling_id:'20'}),child('a',{parent_id:'local',bling_parent_id:'10'}),
    child('b',{parent_id:'local',bling_parent_id:'20'}),child('novo')]);
  const before=structuredClone(db.state.rows);
  const plan=await db.transaction({defaultCompanyId:null,dryRun:true,productId:'novo'});
  assert.equal(plan.parent_id,'local');assert.equal(db.state.writes,0);
  const result=await db.transaction({defaultCompanyId:null,productId:'novo'});
  assert.equal(result.parent_id,'local');assert.equal(result.created,false);
  assert.equal(db.state.rows[0].company_id,'c');assert.equal(db.state.rows[5].parent_id,'local');
  assert.deepEqual(db.state.rows.slice(1,5),before.slice(1,5));
});
test('pai legado compartilhado com outra empresa ou modelo continua bloqueado',async()=>{
  for(const patch of [{company_id:'other'},{model_id:'other'}]){
    const db=database([child('local',{is_parent:1,company_id:null}),child('a',{parent_id:'local'}),child('b',{parent_id:'local',...patch})]);
    await assert.rejects(db.transaction({defaultCompanyId:null}),e=>e.statusCode===409);assert.equal(db.state.writes,0);
  }
});
test('pais Bling com filhos locais e pais locais concorrentes nao sao ignorados',async()=>{
  for(const rows of [
    [child('local',{is_parent:1}),child('bling',{is_parent:1,bling_id:'10'}),child('a',{parent_id:'local',bling_parent_id:'10'}),child('b',{parent_id:'bling'})],
    [child('local',{is_parent:1}),child('outro',{is_parent:1}),child('a',{parent_id:'local'})]]) {
    const db=database(rows);await assert.rejects(db.transaction(),e=>e.statusCode===409);assert.equal(db.state.writes,0);
  }
});
test('outra empresa e produtos combo nao entram na familia',async()=>{
  const db=database([child('a'),child('outro',{company_id:'other'}),child('kit',{is_combo:1})]);
  const r=await db.transaction();assert.equal(r.children.length,1);assert.equal(db.state.rows[1].parent_id,null);assert.equal(db.state.rows[2].parent_id,null);
});
test('empresa default e legado nulo usam escopo canonico',async()=>{
  const db=database([child('a',{company_id:'default'}),child('b',{company_id:null})]);
  const r=await db.transaction({companyId:'default'});assert.equal(r.children.length,2);assert.equal(r.parent.company_id,'c');
});
test('mais de um pai, pai de outro modelo ou orfao bloqueiam sem mudar dados',async()=>{
  for(const rows of [[child('p1',{is_parent:1}),child('p2',{is_parent:1}),child('a')],
    [child('p1',{is_parent:1,model_id:'other'}),child('a',{parent_id:'p1'})],
    [child('a',{parent_id:'missing'})]]) {
    const db=database(rows);await assert.rejects(db.transaction(),e=>e.statusCode===409);assert.equal(db.state.writes,0);
  }
});
test('acessorios nao geram pai de smartphone',async()=>{
  const db=database(undefined,{category_name:'Suportes para celular'});
  await assert.rejects(db.transaction(),e=>e.statusCode===409);assert.equal(db.state.writes,0);
});
test('consulta nao altera banco e revisao obsoleta bloqueia',async()=>{
  const db=database();const plan=await db.transaction({dryRun:true});assert.equal(db.state.writes,0);
  db.state.rows.push(child('c'));await assert.rejects(db.transaction({expectedRevision:plan.revision}),/mudou/);
  assert.equal(db.state.writes,0);
});
test('erro ao vincular causa rollback do novo pai',async()=>{
  const db=database();db.state.failUpdate=true;await assert.rejects(db.transaction(),/simulated/);
  assert.equal(db.state.rows.filter(p=>p.is_parent).length,0);assert.ok(db.state.rows.every(p=>!p.parent_id));
});
test('produto selecionado fora do modelo nao provoca criacao',async()=>{
  const db=database();await assert.rejects(db.transaction({productId:'other'}));assert.equal(db.state.writes,0);
});
test('finalizacao integra familia antes da unidade e dentro da mesma transacao',()=>{
  const src=fs.readFileSync('services/smartphonePhotoIntakeServer.cjs','utf8');
  const finalize=src.slice(src.indexOf("fastify.post('/smartphone-photo-intakes/:id/finalize'"));
  assert.match(finalize,/ensureSmartphoneModelFamily\(connection/);
  assert.ok(finalize.indexOf('ensureSmartphoneModelFamily')<finalize.indexOf('INSERT INTO units'));
  assert.ok(finalize.indexOf('ensureSmartphoneModelFamily')<finalize.lastIndexOf('await connection.commit()'));
  assert.doesNotMatch(finalize,/parent_id=COALESCE/);
});
