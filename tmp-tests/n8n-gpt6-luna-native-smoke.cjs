'use strict';
// Explicit real API test, isolated from workflow triggers, database writes and WhatsApp sends.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Client}=require('ssh2'),{getVpsSshConfig}=require('./vps-ssh-config.cjs');
const {fingerprint}=require('../scripts/n8n-sales-regression-gate.cjs');
const {validate}=require('./n8n-gpt6-luna-migration.cjs');
const {invokeNativeAgent}=require('./n8n-gpt6-luna-native-agent.cjs');
const arg=name=>{const i=process.argv.indexOf(name);assert.ok(i>=0&&process.argv[i+1],'Required '+name);return path.resolve(process.argv[i+1]);};
async function main(){
 const workflow=JSON.parse(fs.readFileSync(arg('--snapshot'),'utf8'));validate(workflow);
 const evidencePath=arg('--evidence');
 const continuityMode=process.argv.includes('--payjoy-continuity');
 const configurationMode=process.argv.includes('--model-configuration');
 const selectedDeviceMode=process.argv.includes('--payjoy-selected-device');
 assert.ok([continuityMode,configurationMode,selectedDeviceMode].filter(Boolean).length<=1,'Choose one extended mode');
 assert.ok(!(continuityMode&&configurationMode),'Choose only one extended native smoke mode');
 const names=['OpenAI Chat Model','OpenAI Classificador','OpenAI Vendas','Agente Geral - Atendimento','Agente Inicial - Classificador','Especialista - Vendas','PayJoy - Ler aprovacao','PayJoy - Calcular entrada do print'];
 if(continuityMode){
  names.push('Vendas - Preparar Contexto IA','Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica');
  for(const name of ['Vendas - Preparar Contexto IA','Agente Inicial - Classificador','Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica']){
   const node=workflow.nodes.find(n=>n.name===name);assert.ok(node,'Continuity node missing: '+name);
   assert.ok(JSON.stringify(node.parameters).includes('payjoy-link-continuity-v1'),'Continuity candidate missing patch: '+name);
  }
 }
 if(configurationMode){
  names.push('Vendas - Preparar Contexto IA','Parse Classificacao','Vendas - Verificar Pos Lista',
   'Resolver Acao de Conversacao','Vendas - Preparar Busca','Vendas - Restaurar Preferencias',
   'Vendas - Contexto Produtos','Vendas - Compor Resposta IA','Dividir mensagens');
  for(const name of ['Vendas - Preparar Busca','Vendas - Contexto Produtos','Vendas - Compor Resposta IA']){
   assert.ok(workflow.nodes.find(n=>n.name===name)?.parameters.jsCode.includes('sales-model-configuration-v1'),
    'Model/configuration candidate missing patch: '+name);
  }
 }
 if(selectedDeviceMode)names.push('Controle Bot - Aplicar Controle','Estado Conversa - Preparar','Dividir mensagens','Vendas - Verificar Pos Lista','Vendas - Preparar Contexto IA','Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica');
 const nodes=workflow.nodes.filter(n=>names.includes(n.name));
 const images=['approval','unreadable'].map(kind=>({kind,data:fs.readFileSync(path.join(__dirname,'fixtures','payjoy-model-test-'+kind+'.png')).toString('base64')}));
 const script=String.raw`
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const parent='/usr/local/lib/node_modules/n8n/node_modules/.pnpm';
const pkg=fs.readdirSync(parent).find(p=>p.startsWith('@n8n+n8n-nodes-langchain@'));
const root=path.join(parent,pkg,'node_modules/@n8n/n8n-nodes-langchain/dist/nodes');
const moduleRequire=require('node:module').createRequire(root+'/llms/LMChatOpenAi/LmChatOpenAi.node.js');
const syntheticEgressFilter=moduleRequire('@n8n/backend-network/egress').passthroughEgressFilter;
const nodes=PAYLOAD_NODES,images=PAYLOAD_IMAGES,continuityMode=PAYLOAD_CONTINUITY,configurationMode=PAYLOAD_CONFIGURATION,selectedDeviceMode=PAYLOAD_SELECTED;
const get=name=>nodes.find(n=>n.name===name);let current='setup',diagnostic=null;const results=[],continuityResults=[],configurationResults=[];
const logger={debug(){},warn(){},error(){},info(){}};
const invokeAgent=NATIVE_AGENT_INVOKE;
const nativeFetch=global.fetch;
const responseRequests=[];
global.fetch=async(url,options)=>{if(/\/(?:responses|chat\/completions)(?:\?|$)/.test(String(url))){const body=JSON.parse(options.body);assert.ok(String(url).includes('/responses'),'Native agent must use the configured Responses API');assert.equal(body.model,'gpt-6-luna','Native model resolution must match candidate');if(!current.startsWith('vision-')){assert.equal(body.reasoning_effort,undefined);assert.equal(body.reasoning?.effort,'none');assert.equal(body.temperature,0);}assert.ok(!('max_tokens' in body));responseRequests.push(current);}return nativeFetch(url,options);};
let source={remoteJid:'synthetic-model-eval',conversation:'',saudacaoDetectada:false,payjoyLinkContext:{ativo:true},salesConversationState:{ativo:false},conversationHistory:'Loja: Quer que eu envie o link oficial da PayJoy para sua análise?',storeHoursContext:'HORARIO_OFICIAL_INDISPONIVEL'};
const dollar=()=>({first:()=>({json:source}),all:()=>[{json:source}]});
function render(text){if(typeof text!=='string')return '';return text.startsWith('={{')?new Function('$json','$','return ('+text.slice(3,-2)+')')(source,dollar):text;}
function clean(text){return String(text).replace(/^\s*[\x60]{3}(?:json)?\s*/,'').replace(/\s*[\x60]{3}\s*$/,'');}
function runCalc(response){const state={payjoyByJid:{},salesPostList:{}};return new Function('$json','$','$getWorkflowStaticData',get('PayJoy - Calcular entrada do print').parameters.jsCode)(response,dollar,()=>state)[0].json;}
const context=node=>({getNode:()=>node,getNodeParameter:(name,i,f)=>name.split('.').reduce((value,key)=>value?.[key],node.parameters)??f,getCredentials:async()=>({apiKey}),getWorkflow:()=>({id:'isolated-model-test',name:'Synthetic model test'}),getExecutionId:()=> 'isolated',getMode:()=> 'manual',getWorkflowSettings:()=>({}),logger,addInputData:()=>({index:0}),addOutputData(){},getInputConnectionData:async()=>null,helpers:{getSecureEgressFilter:()=>syntheticEgressFilter}});
async function model(name){const lm=new(require(root+'/llms/LMChatOpenAi/LmChatOpenAi.node.js').LmChatOpenAi)();const supplied=await lm.supplyData.call(context(get(name)),0);supplied.response.callbacks=[];return supplied.response;}
async function invoke(m,agent,conversation){source.conversation=conversation;const p=get(agent).parameters;return await invokeAgent(m,get(agent),source,render(p.options.systemMessage),render(p.text));}
(async()=>{
 const classifier=await model('OpenAI Classificador');
 for(const [text,decision]of [['oi sim, pois mande','accept'],['agora nao, deixa pra depois','decline'],['sim mas isso e seguro?','question'],['Quero falar com atendente','other']]){
  current='classifier-'+decision;const reply=JSON.parse(clean(await invoke(classifier,'Agente Inicial - Classificador',text)));diagnostic={reply};
  assert.equal(reply.payjoy_link_reply?.decision,decision,'Consent decision mismatch');assert.equal(typeof reply.payjoy_link_reply.confidence,'number');
  if(decision==='accept')assert.ok(reply.payjoy_link_reply.confidence>=0.8);
  results.push({case:current,passed:true});
 }
 current='general-payjoy-context';source.conversationHistory='Loja: Você faz a análise diretamente com a PayJoy pelo link oficial. Cliente: isso e oq';source.aiResponseGuidance='Explique a finalidade do link de análise de crédito já enviado. Não reenvie link, não peça CPF ou documentos.';
 const general=await model('OpenAI Chat Model');const reply=await invoke(general,'Agente Geral - Atendimento','isso e oq');diagnostic={reply};
 assert.match(reply,/an[aá]lise|cr[eé]dito/i);assert.doesNotMatch(reply,/https?:\/\/|(?:envie|informe|manda|passe).{0,30}(?:cpf|documento)/i);results.push({case:current,passed:true});
 current='sales-unavailable';source.aiResponseGuidance='';source.conversationHistory='';source.requestedDeviceModelQuery='Modelo Sintetico XYZ';source.salesAvailabilityStatus='requested_model_not_confirmed_with_stock';source.productsContext='Nenhum produto confirmado para esta consulta';source.deterministicCatalogOutput='';
 const sales=await model('OpenAI Vendas');const salesReply=await invoke(sales,'Especialista - Vendas','Tem o Modelo Sintetico XYZ?');diagnostic={salesReply};
 assert.doesNotMatch(salesReply,/R\$|https?:\/\/|(?:temos|tenho).{0,25}(?:dispon[ií]vel|em estoque)/i);results.push({case:current,passed:true});
 let approvedNative;const params=get('PayJoy - Ler aprovacao').parameters;
 for(const fixture of images){current='vision-'+fixture.kind;
  const ctx={...context(get('PayJoy - Ler aprovacao')),getNodeParameter:(name,i,f)=>name==='modelId'?params.modelId.value:params[name]??f,helpers:{assertBinaryData:()=>({fileName:'synthetic.png',mimeType:'image/png'}),getBinaryDataBuffer:async()=>Buffer.from(fixture.data,'base64'),binaryToBuffer:async x=>x,requestWithAuthentication:async(credential,opts)=>{
   assert.equal(credential,'openAiApi');assert.equal(opts.body.model,'gpt-6-luna');assert.equal(opts.body.max_output_tokens,1600);assert.ok(!('max_tokens' in opts.body));
   const r=await fetch(opts.uri,{method:opts.method,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(opts.body),signal:AbortSignal.timeout(60000)});const j=await r.json();assert.equal(r.status,200,'Vision API rejected native request');return j;
  }}};
  const output=await require(root+'/vendors/OpenAi/v2/actions/image/analyze.operation.js').execute.call(ctx,0);const actual=runCalc(output[0].json);
  if(fixture.kind==='approval'){approvedNative=output[0].json;assert.equal(actual.payjoyCalculation?.amountCents,160000);assert.equal(actual.payjoyCalculation?.percentBp,1400);assert.equal(actual.payjoyCalculation?.entryCents,22400);}else{assert.ok(!actual.payjoyCalculation);assert.match(actual.output,/n[aã]o consegui ler|n[aã]o confirma/i);}
  results.push({case:current,passed:true,status:output[0].json.status});
 }
 if(selectedDeviceMode){
  const jid='synthetic-selected-device@s.whatsapp.net',now=Date.now();
  const variant={productId:'fixture-note70-black',color:'Preto',memory:'8GB/256GB',price:'R$ 1.090,00',priceCents:109000};
  let canonical={payjoyByJid:{status:'awaiting_result',updatedAt:now,expiresAt:now+86400000},salesPostList:{flow:'sales_post_list',step:'awaiting_fulfillment',selectedOptionNumber:1,selectedColor:'Preto',selectedMemoryExactV1:variant.memory,
   options:[{number:1,name:'Realme Note 70',memory:variant.memory,price:variant.price,colors:[variant]}],
   orderDraft:{productId:variant.productId,name:'Realme Note 70',memory:variant.memory,color:variant.color,price:variant.price,unitPriceCents:109000,quantity:1},expiresAt:now+86400000}};
  const code=async(name,input,state,lookup={})=>{
   const dollar=n=>{assert.ok(Object.hasOwn(lookup,n),'Missing selected-device fixture node '+n);return {first:()=>({json:lookup[n]}),all:()=>[{json:lookup[n]}]};};
   return await new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex','fetch',get(name).parameters.jsCode)(input,{first:()=>({json:input}),all:()=>[{json:input}]},dollar,()=>state,{id:'isolated-selected-device'},0,async()=>({ok:false,json:async()=>({})}));
  };
  const load=async(inbound,state)=>(await code('Controle Bot - Aplicar Controle',{control:{conversation_state_revision:1,conversation_state:structuredClone(canonical)}},state,{'Controle Bot - Verificar Cliente':inbound}))[0].json;
  const save=async(reply,loaded,state)=>{canonical=structuredClone((await code('Estado Conversa - Preparar',reply,state,{'Controle Bot - Aplicar Controle':loaded}))[0].json.conversationStatePersistRequest.conversationState);};
  const inbound={remoteJid:jid,Instancia:'synthetic',conversation:'[Imagem recebida]',messageType:'conversation',whatsappImageReceived:true};
  const first={},loaded=await load(inbound,first);
  const photo=(await code('PayJoy - Calcular entrada do print',approvedNative,first,{'Controle Bot - Aplicar Controle':loaded}))[0].json;
  assert.equal(photo.payjoyCalculation.entryCents,22400);assert.match(photo.output,/Seguimos com o Realme Note 70/);await save(photo,loaded,first);
  results.push({case:'selected-photo',passed:true,entryCents:22400});
  let previous=photo.output;
  for(const text of ['Quanto fica a entrada desse aparelho?','Vou retirar na loja','Qual o valor da entrada?','Quanto eu preciso pagar de entrada?']){
   current='selected-'+text;
   const state={},incoming={remoteJid:jid,Instancia:'synthetic',conversation:text,messageType:'conversation',recentMessages:[{direction:'outbound',text:previous,created_at:new Date().toISOString()}],conversationHistory:'Cliente: escolhi Realme Note 70 8GB/256GB Preto. Loja: '+previous};
   const hydrated=await load(incoming,state),before=structuredClone(state.salesPostList[jid]);
   const ctx=(await code('Vendas - Preparar Contexto IA',hydrated,state))[0].json;source=ctx;
   const raw=await invoke(classifier,'Agente Inicial - Classificador',text);
   const parsed=(await code('Parse Classificacao',{output:raw},state,{'Vendas - Preparar Contexto IA':ctx}))[0].json;
   const post=(await code('Vendas - Verificar Pos Lista',{},state,{'Parse Classificacao':parsed}))[0].json;
   let final=post,routed=post;
   if(!post.salesPostListHandled){
    routed=(await code('Resolver Acao de Conversacao',post,state,{'switc Mensagens':hydrated}))[0].json;
    assert.equal(routed.conversationAction,'responder_politica_pagamento','Entry recall must use canonical payment route');
    final=(await code('Pagamento - Politica',{},state,{'Resolver Acao de Conversacao':routed}))[0].json;
   }
   assert.equal(state.salesPostList[jid].orderDraft.productId,variant.productId);
   assert.equal(state.salesPostList[jid].orderDraft.memory,variant.memory);assert.equal(state.salesPostList[jid].orderDraft.color,'Preto');
   if(/entrada/.test(text)){assert.equal(final.payjoyCalculation?.entryCents,22400);assert.deepEqual(state.salesPostList[jid],before);}
   if(text==='Vou retirar na loja'){assert.equal(state.salesPostList[jid].step,'awaiting_pickup_time');assert.equal(state.salesPostList[jid].orderDraft.fulfillment,'pickup');}
   const split=await code('Dividir mensagens',final,state,{'Resolver Acao de Conversacao':routed,'switc Mensagens':hydrated,'Contato - Resolver':{},'Contato - Preparar':{}});
   previous=split.map(item=>item.json.message).join('\n');assert.ok(previous);assert.doesNotMatch(previous,/qual aparelho|envie.{0,20}print|informe.{0,25}percentual/i);
   if(/entrada/.test(text)){assert.match(previous,/224,00/);assert.match(previous,/Realme Note 70/);}
   await save(final,hydrated,state);
   results.push({case:current,passed:true,entryCents:final.payjoyCalculation?.entryCents,step:state.salesPostList[jid].step,selectedSku:variant.productId,outboundMessages:split.length});
  }
 }
 if(continuityMode){
  const fixtureUrl='https://payjoy.com/mdv-synthetic-test';
  const lastOutbound='Você faz a análise diretamente no site oficial da PayJoy e depois retorna com o resultado.';
  const cases=[
   {id:'friend-site-request',text:'Qual que é esse site que você tem como me passar esse site pra me passar pra ele?',decision:'request',send:true},
   {id:'analysis-address-request',text:'Pode me passar o endereço pra fazer a análise?',decision:'request',send:true},
   {id:'explicit-payjoy-request',text:'Me passa o link oficial da PayJoy para fazer a análise.',decision:'request',send:true,history:false},
   {id:'simple-yes-without-offer',text:'sim',send:false},
   {id:'site-safety-question',text:'Esse site é seguro?',decision:'question',send:false},
   {id:'human-request',text:'Quero falar com um atendente.',decision:'other',send:false},
   {id:'decline-request',text:'Não quero esse link nem fazer a análise.',decision:'decline',send:false},
   {id:'approved-result',text:'Fui aprovado, e agora?',decision:'other',send:false},
   {id:'catalog-change',text:'Quais celulares você tem disponíveis?',decision:'other',send:false},
   {id:'physical-delivery',text:'Pode enviar pelo motoboy?',decision:'other',send:false},
   {id:'site-without-context',text:'Pode me passar esse site?',send:false,history:false},
   {id:'expired-reference',text:'Pode me passar esse site?',send:false,stale:true},
  ];
  for(const fixture of cases){
   current='continuity-'+fixture.id;
   const jid='synthetic-continuity@s.whatsapp.net';
   const state={payjoyByJid:{},salesPostList:{}};
   const createdAt=new Date(Date.now()-(fixture.stale?25*3600000:60000)).toISOString();
   const inbound={remoteJid:jid,Instancia:'synthetic',conversation:fixture.text,saudacaoDetectada:false,
    recentMessages:fixture.history===false?[]:[{direction:'outbound',text:lastOutbound,created_at:createdAt}],
    conversationHistory:fixture.history===false?'':'Loja ('+createdAt+'): '+lastOutbound,
   };
   let contextReads=0;
   const code=async(name,payload,lookup)=>{
    const dollar=name=>{
     if(!Object.hasOwn(lookup,name))throw Error('Unexecuted node referenced by continuity fixture: '+name);
     return {first:()=>({json:lookup[name]}),all:()=>[{json:lookup[name]}]};
    };
    const stubFetch=async()=>{
     assert.equal(name,'Vendas - Preparar Contexto IA','Continuity code attempted an external request');
     contextReads++;return {ok:false,json:async()=>({})};
    };
    const items=await new Function('$json','$','$getWorkflowStaticData','$input','fetch',get(name).parameters.jsCode)(
     payload,dollar,()=>state,{all:()=>[{json:payload}]},stubFetch);
    assert.ok(Array.isArray(items)&&items[0]?.json,'Continuity code returned no item: '+name);
    return items[0].json;
   };
   const prepared=await code('Vendas - Preparar Contexto IA',inbound,{});
   assert.equal(contextReads,1,'Store-hours read must remain stubbed');
   assert.equal(prepared.payjoyLinkContext.ativo,false,'Fixture has no pending link offer');
   if(fixture.history===false&&!fixture.send||fixture.stale)assert.notEqual(prepared.payjoyLinkContext.referenciaDisponivel,true,'Context reference must expire or be absent');
   else assert.equal(prepared.payjoyLinkContext.referenciaDisponivel,true,'Recent or explicit PayJoy reference missing');
   for(const key of Object.keys(source))delete source[key];Object.assign(source,prepared);
   const raw=await invoke(classifier,'Agente Inicial - Classificador',fixture.text);
   const classification=JSON.parse(clean(raw));
   diagnostic={case:fixture.id,classification};
   if(fixture.decision)assert.equal(classification.payjoy_link_reply?.decision,fixture.decision,'Continuity semantic decision mismatch: '+fixture.id);
   if(fixture.send)assert.ok(classification.payjoy_link_reply.confidence>=0.8,'Explicit request must meet confidence threshold');
   const parsed=await code('Parse Classificacao',{output:raw},{'Vendas - Preparar Contexto IA':prepared});
   const resolved=await code('Resolver Acao de Conversacao',parsed,{'switc Mensagens':inbound});
   let payment=null;
   if(resolved.conversationAction==='responder_politica_pagamento'){
    payment=await code('Pagamento - Politica',{payjoy_analysis_url:fixtureUrl},{'Resolver Acao de Conversacao':resolved});
   }
   const emitted=String(payment?.output||'').includes(fixtureUrl);
   diagnostic={...diagnostic,preservedDecision:parsed.payjoyLinkReply?.decision,action:resolved.conversationAction,emitted};
   assert.equal(emitted,fixture.send,'Configured URL routing mismatch: '+fixture.id);
   if(fixture.send){
    assert.equal(parsed.payjoyLinkReply?.decision,'request','Parser discarded explicit contextual request');
    assert.equal(resolved.conversationAction,'responder_politica_pagamento');
    assert.equal(payment.payjoyNeedsHandoff,false,'Configured URL must not require a fabricated handoff');
   }else{
    assert.ok(!payment||!/https?:\/\//.test(String(payment.output||'')),'Negative fixture emitted a URL');
    assert.notEqual(state.payjoyByJid[jid]?.status,'awaiting_result','Negative fixture advanced to awaiting analysis');
   }
   assert.ok(responseRequests.includes(current),'No native Agent Responses request for '+fixture.id);
   continuityResults.push({case:current,passed:true,decision:classification.payjoy_link_reply?.decision,
    action:resolved.conversationAction,configuredUrlEmitted:emitted});
  }
 }
 if(configurationMode){
  const jid='synthetic-configuration@s.whatsapp.net',category='8b7c4852-c195-4527-8fd7-c3cc2debda42';
  const state={salesPostList:{},payjoyByJid:{}};
  const product=(id,model,ram=6,storage=128,color='Preto',extra={})=>({id,model_id:model,model_name:model,
   name:model+' '+color,brand:'Xiaomi',category_id:category,status:'active',stock_quantity:1,price_retail:129900,
   specs:{ram:ram+'GB',storage:storage+'GB',color,network:/5G/i.test(model)?'5G':'4G',rede:/5G/i.test(model)?'5G':'4G'},
   slug:id,images:[],...extra});
  const catalog=[...['Preto','Azul','Verde','Roxo'].map((color,i)=>product('same-'+i,'Redmi Note 15 4G',6,128,color)),
   product('unavailable-256','Redmi Note 15 4G',8,256,'Preto',{stock_quantity:0}),
   product('other-pro','Redmi Note 15 Pro 4G',8,256),product('other-5g','Redmi Note 15 5G',8,256),
   product('other-14s','Redmi Note 14S',8,256),product('other-15','Redmi 15',8,256)];
  const runCode=async(name,input={},sources={},all=[input])=>{
   const lookup=key=>{
    assert.ok(Object.hasOwn(sources,key),'Unexecuted model/configuration node: '+key+' from '+name);
    const rows=Array.isArray(sources[key])?sources[key]:[sources[key]];
    return {first:()=>({json:rows[0]}),all:()=>rows.map(json=>({json})),item:{json:rows[0]}};
   };
   const stubFetch=async()=>{
    assert.ok(['Vendas - Preparar Contexto IA','Vendas - Verificar Pos Lista'].includes(name),'Unexpected external request in '+name);
    return {ok:false,json:async()=>({})};
   };
   return await new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex','fetch',get(name).parameters.jsCode)(
    input,{all:()=>all.map(json=>({json})),first:()=>({json:input})},lookup,()=>state,{id:'synthetic-model-configuration'},0,stubFetch);
  };
  const activate=payload=>{for(const key of Object.keys(source))delete source[key];Object.assign(source,payload);};
  const turns=['Oi bom dia\nVcs tem o redimi note 15 4g 256gb 8gb ram','Eu qra msm o redmi note 15'];
  let preferences={},previousReply='';
  for(let turn=0;turn<turns.length;turn++){
   const text=turns[turn];current='configuration-turn-'+(turn+1)+'-classifier';
   const inbound={remoteJid:jid,Instancia:'synthetic',conversation:text,
    n8nBotControl:{sales_preferences:{active:true,constraints:structuredClone(preferences)}},
    recentMessages:previousReply?[{direction:'outbound',text:previousReply,created_at:new Date(Date.now()-60000).toISOString()}]:[],
    conversationHistory:previousReply?'Loja: '+previousReply:'',
   };
   const contextResult=(await runCode('Vendas - Preparar Contexto IA',inbound))[0].json;
   activate(contextResult);
   const classifierText=await invoke(classifier,'Agente Inicial - Classificador',text);
   const classification=JSON.parse(clean(classifierText));diagnostic={turn:turn+1,classification};
   const parsed=(await runCode('Parse Classificacao',{output:classifierText},{'Vendas - Preparar Contexto IA':contextResult}))[0].json;
   const post=(await runCode('Vendas - Verificar Pos Lista',{}, {'Parse Classificacao':parsed}))[0]?.json||parsed;
   const resolved=(await runCode('Resolver Acao de Conversacao',post,{'Parse Classificacao':parsed,'switc Mensagens':inbound}))[0].json;
   assert.ok(['buscar_produto','listar_catalogo'].includes(resolved.conversationAction),'Native classification did not route to catalog lookup');
   const prepared=(await runCode('Vendas - Preparar Busca',resolved))[0].json;
   diagnostic={...diagnostic,action:resolved.conversationAction,requestedRamGb:prepared.requestedRamGb,
    requestedStorageGb:prepared.requestedStorageGb,requestedNetwork:prepared.requestedNetwork};
   assert.equal(prepared.requestedNetwork,'4g','Requested 4G identity was lost');
   assert.deepEqual(prepared.requestedRamGb,turn===0?[8]:[],'Network was mistaken for RAM or inherited memory was retained');
   assert.deepEqual(prepared.requestedStorageGb,turn===0?[256]:[],'Requested or inherited storage mismatch');
   const acknowledgment={ok:true,preferences:{active:true,family:'smartphone',constraints:structuredClone(prepared.salesFilters||{})}};
   const restored=(await runCode('Vendas - Restaurar Preferencias',acknowledgment,{'Vendas - Preparar Busca':prepared}))[0].json;
   const productsContext=(await runCode('Vendas - Contexto Produtos',{}, {'Vendas - Preparar Busca':restored,
    'Vendas - Buscar Produtos':structuredClone(catalog),'switc Mensagens':inbound},
    [{channel:'presencial',installments:12,applied_fee_pct:11.9}]))[0].json;
   const variantIds=(productsContext.productsInStock||[]).flatMap(p=>(p.variants||[]).map(v=>v.productId));
   diagnostic={...diagnostic,status:productsContext.salesAvailabilityStatus,variantIds};
   assert.ok(variantIds.length>0,'No same-model products offered');
   assert.ok(variantIds.every(id=>id.startsWith('same-')),'A different model, network or zero-stock SKU was offered');
   assert.equal(productsContext.salesAvailabilityStatus,turn===0?'requested_configuration_unavailable_with_same_model':'confirmed_products_available');
   activate(productsContext);current='configuration-turn-'+(turn+1)+'-sales';
   const naturalReply=await invoke(sales,'Especialista - Vendas',text);
   const composed=(await runCode('Vendas - Compor Resposta IA',{output:naturalReply},{'Vendas - Contexto Produtos':productsContext}))[0].json;
   const split=await runCode('Dividir mensagens',composed,{'Resolver Acao de Conversacao':resolved,'switc Mensagens':inbound,
    'Contato - Resolver':{},'Contato - Preparar':{}});
   const reply=split.map(item=>item.json.message||'').join('\n');
   assert.match(reply,/6\s*GB\s*\/\s*128\s*GB/i,'Confirmed available configuration missing');
   assert.doesNotMatch(reply,/(?:n[aã]o temos esse modelo|Note\s*15\s*Pro|Note\s*15\s*5G|Note\s*14S|Redmi\s+15\b)/i,
    'Final answer denies the available model or offers a different identity');
   assert.equal(state.salesPostList[jid]?.orderDraft,undefined,'A catalog request created a sale draft');
   assert.equal(state.salesPostList[jid]?.filters?.network,'4g','Conversation state lost the requested network');
   const options=state.salesPostList[jid]?.options||[];assert.ok(options.length>0,'No selectable offer preserved');
   assert.ok(options.every(option=>(option.colors||[]).length>0&&(option.colors||[]).every(color=>String(color.productId).startsWith('same-'))),
    'Selectable offer contains another model');
   assert.ok(responseRequests.includes('configuration-turn-'+(turn+1)+'-classifier'));
   assert.ok(responseRequests.includes('configuration-turn-'+(turn+1)+'-sales'));
   configurationResults.push({case:'configuration-turn-'+(turn+1),passed:true,requestedRamGb:prepared.requestedRamGb,
    requestedStorageGb:prepared.requestedStorageGb,requestedNetwork:prepared.requestedNetwork,
    status:productsContext.salesAvailabilityStatus,variantIds,outboundMessages:split.length,draftCreated:false});
   preferences=structuredClone(prepared.salesFilters||{});previousReply=reply;
  }
 }
 for(const item of results)if(item.case!=='selected-photo')assert.ok(responseRequests.includes(item.case),'No Responses request captured for '+item.case);
 console.log(JSON.stringify({passed:true,cases:results,responsesApi:true,nativeAgentExecution:true,
  ...(continuityMode?{payjoyContinuityCases:continuityResults}:{}),
  ...(configurationMode?{salesModelConfigurationCases:configurationResults}:{})}));
})().catch(e=>{const safeReason=String(e.message||'').replaceAll(apiKey,'[REDACTED]').replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,180);console.log(JSON.stringify({passed:false,failedCase:current,errorName:e.name,errorReason:safeReason,diagnostic,cases:results,
 ...(continuityMode?{payjoyContinuityCases:continuityResults}:{}),
 ...(configurationMode?{salesModelConfigurationCases:configurationResults}:{})}));process.exitCode=1});
`.replace('PAYLOAD_NODES',()=>JSON.stringify(nodes)).replace('PAYLOAD_IMAGES',()=>JSON.stringify(images)).replace('PAYLOAD_CONTINUITY',()=>JSON.stringify(continuityMode)).replace('PAYLOAD_CONFIGURATION',()=>JSON.stringify(configurationMode)).replace('PAYLOAD_SELECTED',()=>JSON.stringify(selectedDeviceMode)).replace('NATIVE_AGENT_INVOKE',()=>invokeNativeAgent.toString());
 // Code-node source may contain $&, $` or $' replacement tokens. Functional
 // substitutions preserve their literal bytes; compile before any remote call.
 new Function(script);
 // Existing configured shop API credential stays in the remote process and stdin only.
 const keyReader="require('dotenv').config({path:'.env',quiet:true});(async()=>{const p=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});try{const [[r]]=await p.query('SELECT openai_api_key FROM autoresponder_settings WHERE id=1 LIMIT 1');process.stdout.write(JSON.stringify(String(r?.openai_api_key||process.env.OPENAI_API_KEY||'').trim()));}finally{await p.end();}})().catch(()=>process.exit(1));";
 const py='import subprocess,json\nkey=json.loads(subprocess.check_output(["node","-e",'+JSON.stringify(keyReader)+'],cwd="/var/www/mdv-api",text=True))\nassert key\nc=next(x for x in subprocess.check_output(["docker","ps","--format","{{.Names}}"],text=True).splitlines() if x.startswith("n8n_n8n."))\nraise SystemExit(subprocess.run(["docker","exec","-i",c,"node","--input-type=commonjs","--no-experimental-strip-types"],input="const apiKey="+json.dumps(key)+";\\n"+'+JSON.stringify(script)+',text=True).returncode)';
 const c=new Client();await new Promise((r,j)=>c.once('ready',r).once('error',j).connect(getVpsSshConfig()));
 try{
  const result=await new Promise((resolve,reject)=>c.exec('python3 -',(e,s)=>{if(e)return reject(e);let out='',stderr='',decoded;s.on('data',d=>out+=d);s.stderr.on('data',d=>stderr+=d);s.on('close',code=>{try{const result=JSON.parse(out.trim());decoded=result;assert.equal(code,0,'Native model tests failed');assert.equal(result.passed,true);resolve(result);}catch(error){
   // Node/Python stderr may echo the generated source line containing the API key.
   // Retain only explicit exception-summary lines, never source excerpts or stacks.
   const safeErrors=stderr.split(/\r?\n/).filter(line=>/^(?:[A-Za-z][A-Za-z0-9]*)?(?:Error|Exception)(?: \[ERR_[A-Z_]+\])?:\s/.test(line))
    .filter(line=>!/apiKey\s*=|Bearer\s|sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{10}/i.test(line)).map(line=>line.slice(0,240));
   const errorClasses=[...new Set(stderr.match(/\b(?:AssertionError|SyntaxError|ReferenceError|TypeError|RangeError|OSError|MemoryError|NameError|KeyError|ValueError|Traceback|Error)\b/g)||[])];
   const knownCauses=[['module-not-found',/Cannot find module|ERR_MODULE_NOT_FOUND/],['docker-container-unavailable',/No such container|is not running/],
    ['stdin-stream',/EPIPE|ENOBUFS|stream.*(?:closed|destroyed)/],['argument-too-long',/argument list too long|E2BIG/],
    ['source-unicode-escape',/Expected unicode escape|Invalid or unexpected token/],['access-denied',/EACCES|permission denied/i],
    ['connection-refused',/ECONNREFUSED/],['syntax',/SyntaxError|Unexpected (?:token|identifier)/],
    ['memory-limit',/heap out of memory|Killed|MemoryError/]].filter(([,pattern])=>pattern.test(stderr)).map(([name])=>name);
   const safeSummaries=stderr.split(/\r?\n/).map(line=>line.replace(/\x1b\[[0-9;]*m/g,'').trim())
    .filter(line=>line.length>0&&line.length<300&&!/api.?key|authorization|bearer|secret|password|sk-|eyJ|\bconst\b|\brequire\b|\bprocess\b|^at |^File |Traceback|^[\s^]+$/i.test(line))
    .map(line=>line.replace(/https?:\/\/\S+/g,'[URL]').replace(/[A-Za-z0-9_=-]{24,}/g,'[REDACTED]')).slice(-3);
   const builtinFrames=stderr.split(/\r?\n/).map(line=>line.trim()).filter(line=>/^at [A-Za-z0-9 ._]+\(node:internal\/[A-Za-z0-9_/.:-]+\)$/.test(line)).slice(0,4);
   const safeOutput=decoded?JSON.stringify({failedCase:decoded.failedCase,errorName:decoded.errorName,errorReason:decoded.errorReason,diagnostic:decoded.diagnostic,
    passedBaseCases:decoded.cases?.filter(item=>item.passed).length,payjoyContinuityCases:decoded.payjoyContinuityCases,
    salesModelConfigurationCases:decoded.salesModelConfigurationCases}):out.slice(-700);
   reject(Error('Native tests failed (exit '+code+', stderrBytes '+stderr.length+', classes '+errorClasses.join(',')+', causes '+knownCauses.join(',')+'); '+safeOutput+(safeErrors.length?' '+safeErrors.join('; '):' '+safeSummaries.join('; '))+' '+builtinFrames.join('; ')));
  }});s.end(py);}));
  const evidence={...result,sha256:fingerprint(workflow),testedAt:new Date().toISOString(),credentialSource:'existing-shop-api',nativeN8nModules:true};
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify(evidence,null,2));
 }finally{c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
