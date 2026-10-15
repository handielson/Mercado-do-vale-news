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
 const names=['OpenAI Chat Model','OpenAI Classificador','OpenAI Vendas','Agente Geral - Atendimento','Agente Inicial - Classificador','Especialista - Vendas','PayJoy - Ler aprovacao','PayJoy - Calcular entrada do print'];
 const nodes=workflow.nodes.filter(n=>names.includes(n.name));
 const images=['approval','unreadable'].map(kind=>({kind,data:fs.readFileSync(path.join(__dirname,'fixtures','payjoy-model-test-'+kind+'.png')).toString('base64')}));
 const script=String.raw`
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const parent='/usr/local/lib/node_modules/n8n/node_modules/.pnpm';
const pkg=fs.readdirSync(parent).find(p=>p.startsWith('@n8n+n8n-nodes-langchain@'));
const root=path.join(parent,pkg,'node_modules/@n8n/n8n-nodes-langchain/dist/nodes');
const nodes=PAYLOAD_NODES,images=PAYLOAD_IMAGES;
const get=name=>nodes.find(n=>n.name===name);let current='setup',diagnostic=null;const results=[];
const logger={debug(){},warn(){},error(){},info(){}};
const invokeAgent=NATIVE_AGENT_INVOKE;
const nativeFetch=global.fetch;
const responseRequests=[];
global.fetch=async(url,options)=>{if(/\/(?:responses|chat\/completions)(?:\?|$)/.test(String(url))){const body=JSON.parse(options.body);assert.ok(String(url).includes('/responses'),'Native agent must use the configured Responses API');assert.equal(body.model,'gpt-6-luna','Native model resolution must match candidate');if(!current.startsWith('vision-')){assert.equal(body.reasoning_effort,undefined);assert.equal(body.reasoning?.effort,'none');assert.equal(body.temperature,0);}assert.ok(!('max_tokens' in body));responseRequests.push(current);}return nativeFetch(url,options);};
const source={remoteJid:'synthetic-model-eval',conversation:'',saudacaoDetectada:false,payjoyLinkContext:{ativo:true},salesConversationState:{ativo:false},conversationHistory:'Loja: Quer que eu envie o link oficial da PayJoy para sua análise?',storeHoursContext:'HORARIO_OFICIAL_INDISPONIVEL'};
const dollar=()=>({first:()=>({json:source}),all:()=>[{json:source}]});
function render(text){if(typeof text!=='string')return '';return text.startsWith('={{')?new Function('$json','$','return ('+text.slice(3,-2)+')')(source,dollar):text;}
function clean(text){return String(text).replace(/^\s*[\x60]{3}(?:json)?\s*/,'').replace(/\s*[\x60]{3}\s*$/,'');}
function runCalc(response){const state={payjoyByJid:{},salesPostList:{}};return new Function('$json','$','$getWorkflowStaticData',get('PayJoy - Calcular entrada do print').parameters.jsCode)(response,dollar,()=>state)[0].json;}
const context=node=>({getNode:()=>node,getNodeParameter:(name,i,f)=>name.split('.').reduce((value,key)=>value?.[key],node.parameters)??f,getCredentials:async()=>({apiKey}),getWorkflow:()=>({id:'isolated-model-test',name:'Synthetic model test'}),getExecutionId:()=> 'isolated',getMode:()=> 'manual',getWorkflowSettings:()=>({}),logger,addInputData(){},addOutputData(){},getInputConnectionData:async()=>null});
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
 const params=get('PayJoy - Ler aprovacao').parameters;
 for(const fixture of images){current='vision-'+fixture.kind;
  const ctx={...context(get('PayJoy - Ler aprovacao')),getNodeParameter:(name,i,f)=>name==='modelId'?params.modelId.value:params[name]??f,helpers:{assertBinaryData:()=>({fileName:'synthetic.png',mimeType:'image/png'}),getBinaryDataBuffer:async()=>Buffer.from(fixture.data,'base64'),binaryToBuffer:async x=>x,requestWithAuthentication:async(credential,opts)=>{
   assert.equal(credential,'openAiApi');assert.equal(opts.body.model,'gpt-6-luna');assert.equal(opts.body.max_output_tokens,1600);assert.ok(!('max_tokens' in opts.body));
   const r=await fetch(opts.uri,{method:opts.method,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(opts.body),signal:AbortSignal.timeout(60000)});const j=await r.json();assert.equal(r.status,200,'Vision API rejected native request');return j;
  }}};
  const output=await require(root+'/vendors/OpenAi/v2/actions/image/analyze.operation.js').execute.call(ctx,0);const actual=runCalc(output[0].json);
  if(fixture.kind==='approval'){assert.equal(actual.payjoyCalculation?.amountCents,160000);assert.equal(actual.payjoyCalculation?.percentBp,1400);assert.equal(actual.payjoyCalculation?.entryCents,22400);}else{assert.ok(!actual.payjoyCalculation);assert.match(actual.output,/n[aã]o consegui ler|n[aã]o confirma/i);}
  results.push({case:current,passed:true,status:output[0].json.status});
 }
 for(const item of results)assert.ok(responseRequests.includes(item.case),'No Responses request captured for '+item.case);
 console.log(JSON.stringify({passed:true,cases:results,responsesApi:true,nativeAgentExecution:true}));
})().catch(e=>{console.log(JSON.stringify({passed:false,failedCase:current,errorName:e.name,diagnostic,cases:results}));process.exitCode=1});
`.replace('PAYLOAD_NODES',JSON.stringify(nodes)).replace('PAYLOAD_IMAGES',JSON.stringify(images)).replace('NATIVE_AGENT_INVOKE',invokeNativeAgent.toString());
 // Existing configured shop API credential stays in the remote process and stdin only.
 const keyReader="require('dotenv').config({path:'.env',quiet:true});(async()=>{const p=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});try{const [[r]]=await p.query('SELECT openai_api_key FROM autoresponder_settings WHERE id=1 LIMIT 1');process.stdout.write(JSON.stringify(String(r?.openai_api_key||process.env.OPENAI_API_KEY||'').trim()));}finally{await p.end();}})().catch(()=>process.exit(1));";
 const py='import subprocess,json\nkey=json.loads(subprocess.check_output(["node","-e",'+JSON.stringify(keyReader)+'],cwd="/var/www/mdv-api",text=True))\nassert key\nc=next(x for x in subprocess.check_output(["docker","ps","--format","{{.Names}}"],text=True).splitlines() if x.startswith("n8n_n8n."))\nraise SystemExit(subprocess.run(["docker","exec","-i",c,"node"],input="const apiKey="+json.dumps(key)+";\\n"+'+JSON.stringify(script)+',text=True).returncode)';
 const c=new Client();await new Promise((r,j)=>c.once('ready',r).once('error',j).connect(getVpsSshConfig()));
 try{
  const result=await new Promise((resolve,reject)=>c.exec('python3 -',(e,s)=>{if(e)return reject(e);let out='';s.on('data',d=>out+=d);s.stderr.on('data',()=>{});s.on('close',code=>{try{const result=JSON.parse(out.trim());assert.equal(code,0,'Native model tests failed');assert.equal(result.passed,true);resolve(result);}catch(error){reject(Error('Native tests failed; '+out.slice(-700)));}});s.end(py);}));
  const evidence={...result,sha256:fingerprint(workflow),testedAt:new Date().toISOString(),credentialSource:'existing-shop-api',nativeN8nModules:true};
  fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify(evidence,null,2));
 }finally{c.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
