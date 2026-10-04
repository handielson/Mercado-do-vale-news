const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAccountingHistory, saveAccountingHistory } = require('../services/accountingHistoryCore.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const fixture = () => ({schema:'mdv.pgdas-history.v1',cnpj:'11222333000181',basis:'accrual',source:{kind:'pgdas_pdf',filename:'extrato.pdf',sha256:'a'.repeat(64),competence:'2026-08',generatedOn:'2026-09-11'},
  months:Array.from({length:20},(_,i)=>({competence:new Date(Date.UTC(2025,i,1)).toISOString().slice(0,7),totalCents:100})),
  declared:{rbt12Cents:1200,rpaCents:100,rbaCents:800,rbaaCents:1200,dasCents:4,commerceCents:75,servicesCents:25}});
test('PGDAS: soma os 12 meses anteriores, inclui serviços e mantém zero declarado',()=>{
  const result=normalizeAccountingHistory(fixture(),'11222333000181');
  assert.equal(result.months.length,20);assert.equal(result.declared.rbt12Cents,1200);assert.equal(result.declared.servicesCents,25);
  assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
});
test('PGDAS: rejeita outra empresa, duplicidade, valor decimal e totais divergentes',()=>{
  assert.throws(()=>normalizeAccountingHistory(fixture(),'99999999999999'),/outra empresa/);
  for(const change of [x=>x.months.push(x.months[0]),x=>x.months[0].totalCents=1.2,x=>x.declared.rbt12Cents++,x=>x.declared.rbaCents++,x=>x.declared.rbaaCents++,x=>x.declared.servicesCents++]) {
    const input=fixture();change(input);assert.throws(()=>normalizeAccountingHistory(input,input.cnpj));
  }
});
function database(initial=null) {
  let current=initial,commits=0,rollbacks=0,inserts=0,released=false;
  const db={beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},release:()=>{released=true;},
    query:async(sql,args)=>{
      if(sql.startsWith('SELECT id,details'))return [current?[{id:7,details:current,created_at:'2026-10-04'}]:[]];
      if(sql.startsWith('INSERT INTO company_fiscal_events')){assert.equal(args[2],'pgdas_history_import');inserts++;current=JSON.parse(args[3]);return [{}];}
      return [[{id:'profile'}]];
    }};
  return {getConnection:async()=>db,state:()=>({commits,rollbacks,inserts,released})};
}
test('PGDAS: grava snapshot auditável e repetir a mesma fonte não duplica',async()=>{
  const pool=database();const profile={id:'profile',cnpj:fixture().cnpj};
  const first=await saveAccountingHistory(pool,profile,{history:fixture(),version:0},'operator');assert.equal(first.version,7);
  const second=await saveAccountingHistory(pool,profile,{history:fixture(),version:0},'operator');assert.equal(second.unchanged,true);assert.equal(pool.state().inserts,1);
});
test('PGDAS: concorrência aborta a transação sem sobrescrever histórico',async()=>{
  const initial=normalizeAccountingHistory(fixture(),fixture().cnpj);const pool=database(initial);const changed=fixture();changed.source.sha256='b'.repeat(64);
  await assert.rejects(saveAccountingHistory(pool,{id:'profile',cnpj:initial.cnpj},{history:changed,version:0},'operator'),/outra sessão/);
  assert.deepEqual(pool.state(),{commits:0,rollbacks:1,inserts:0,released:true});
});
test('PGDAS: consulta exige permissão da empresa e importação é exclusiva do admin',async()=>{
  const routes=new Map();const app={get:(path,options,handler)=>routes.set('get:'+path,{options,handler}),post:(path,options,handler)=>routes.set('post:'+path,{options,handler}),put:()=>{},delete:()=>{}};
  registerAccountantPortalRoutes(app,{pool:{},enabled:true,getBearerAuthContext:async()=>null});
  const get=routes.get('get:/accountant/companies/:id/accounting-history');const post=routes.get('post:/accountant/companies/:id/accounting-history');
  const reply={header:()=>{},sent:false,code(value){this.status=value;return this;},send(){this.sent=true;}};
  await get.options.preHandler({},reply);assert.equal(reply.status,401);
  await assert.rejects(post.handler({accountantAuth:{isAdmin:false}}),/Somente o administrador/);
});
