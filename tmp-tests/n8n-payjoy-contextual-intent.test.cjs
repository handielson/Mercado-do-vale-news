const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patchWorkflow,validate}=require('./n8n-payjoy-contextual-intent-patch.cjs');
assert(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'Provide read-only workflow snapshot');
const original=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'utf8')),updated=patchWorkflow(original),code=n=>updated.nodes.find(x=>x.name===n).parameters.jsCode;
test('patch semantico preserva grafo, prints/calculo e todos os nos fora do escopo',()=>{
 const names=new Set(['Vendas - Preparar Contexto IA','Agente Inicial - Classificador','Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica','Agente Geral - Atendimento']);
 assert.deepEqual(updated.connections,original.connections);for(const n of original.nodes)if(!names.has(n.name))assert.deepEqual(updated.nodes.find(x=>x.id===n.id),n);
 assert.deepEqual(patchWorkflow(updated),updated);assert.equal(validate(updated).semanticConsentSendsOfficialLink,true);
 assert.doesNotMatch(code('Resolver Acao de Conversacao'),/payjoyShortAffirmativeV1/);assert.doesNotMatch(code('Pagamento - Politica'),/payjoyAffirmativeV1/);
});
test('parse usa contexto da origem, enum fechado e confianca numerica; JSON invalido nao autoriza',()=>{
 const source={remoteJid:'fixture',conversation:'oi sim',payjoyLinkContext:{ativo:true},recentMessages:[]};
 const parse=(reply,src=source)=>new Function('$json','$',code('Parse Classificacao'))({output:JSON.stringify({intencao:'saudacao',payjoy_link_reply:reply})},()=>({first:()=>({json:src})}))[0].json;
 assert.deepEqual(parse({decision:'accept',confidence:0.99}).payjoyLinkReply,{decision:'accept',confidence:0.99});
 for(const reply of [null,{decision:'send',confidence:1},{decision:'accept',confidence:'1'},{decision:'accept',confidence:0.79},{decision:'accept',confidence:1.1}])assert.equal(parse(reply).payjoyLinkReply,null);
 assert.equal(parse({decision:'accept',confidence:1},{...source,payjoyLinkContext:{ativo:false}}).payjoyLinkReply,null);
 const malformed=new Function('$json','$',code('Parse Classificacao'))({output:'{not-json'},()=>({first:()=>({json:source})}))[0].json;
 if(code('Parse Classificacao').includes('attendance-classifier-recovery-v1')) {
  assert.equal(malformed.classifierRecovery,true);
  assert.equal(malformed.payjoyLinkReply,undefined);
  assert.match(malformed.output,/tentar novamente/i);
 } else assert.equal(malformed.payjoyLinkReply,null);
});
test('IA recebe oferta pendente apenas dentro do prazo e pergunta anterior mais recente',async()=>{
 const jid='fixture',src={remoteJid:jid,recentMessages:[{direction:'outbound',text:'Oferta antiga',created_at:'2026-10-10T10:00:00Z'},{direction:'outbound',text:'Quer o link oficial PayJoy?',created_at:'2026-10-12T10:00:00Z'}]};
 const run=async state=>new Function('$json','$getWorkflowStaticData','fetch',code('Vendas - Preparar Contexto IA'))(src,()=>state,async()=>({ok:false}));
 const state={payjoyByJid:{[jid]:{status:'awaiting_link_confirmation',updatedAt:Date.now(),expiresAt:Date.now()+10000}}};
 const active=(await run(state))[0].json;assert.equal(active.payjoyLinkContext.ativo,true);assert.equal(active.payjoyLinkContext.perguntaAnterior,'Quer o link oficial PayJoy?');
 state.payjoyByJid[jid].expiresAt=Date.now()-1;assert.equal((await run(state))[0].json.payjoyLinkContext.ativo,false);
 state.payjoyByJid[jid].status='declined';state.payjoyByJid[jid].expiresAt=Date.now()+10000;assert.equal((await run(state))[0].json.payjoyLinkContext.ativo,false);
});
