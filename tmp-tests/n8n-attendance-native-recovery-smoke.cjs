'use strict';
// Isolated n8n CLI smoke: real Code/IF/HTTP nodes, synthetic JID and local HTTP sink.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const input=process.argv[2];
assert.ok(input,'Usage: node n8n-attendance-native-recovery-smoke.cjs workflow.json');
const caseName=process.argv[3]||'error';
assert.ok(['error','malformed','blocked'].includes(caseName),'Unknown synthetic case');
const source=JSON.parse(fs.readFileSync(input,'utf8'));
const get=name=>structuredClone(source.nodes.find(n=>n.name===name));
const edge=node=>({node,type:'main',index:0});
const node=(name,jsCode,x)=>({name,id:name,type:'n8n-nodes-base.code',typeVersion:2,position:[x,200],parameters:{jsCode}});
async function main(){
 const received=[];
 const server=http.createServer(async(req,res)=>{
  let body='';for await(const part of req)body+=part;
  received.push({url:req.url,body:JSON.parse(body)});
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({key:{id:'synthetic-ack'}}));
 });
 await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
 const port=server.address().port;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdv-n8n-recovery-'));
 try{
  const start={name:'Manual Trigger',id:'fixture-trigger',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,200],parameters:{}};
  const context=node('Vendas - Preparar Contexto IA',`return [{json:{remoteJid:'synthetic-test-only@s.whatsapp.net',conversation:'sim',messageId:'fixture-id',Instancia:'synthetic',fromMe:false,n8nBotBlocked:${caseName==='blocked'}}}];`,200);
  const failure=node('Agente Inicial - Classificador',caseName==='malformed'
   ? "return [{json:{output:'not-json'}}];"
   : "return [{json:{error:{message:'Bad request - synthetic classifier failure'}}}];",400);
  const parser=get('Parse Classificacao'),branch=get('Classificacao - Falhou?'),split=get('Dividir mensagens'),send=get('Enviar WhatsApp');
  assert.equal(source.nodes.find(n=>n.name==='Agente Inicial - Classificador').onError,'continueRegularOutput');
  parser.position=[600,200];branch.position=[800,200];split.position=[1000,200];send.position=[1200,200];
  send.parameters.url=`http://host.docker.internal:${port}/message/sendText/botmercadodovale`;
  send.parameters.headerParameters={parameters:[{name:'apikey',value:'synthetic-only'}]};
  const fixture={id:'fixture-attendance-recovery',name:'MDV synthetic attendance recovery',active:false,nodes:[start,context,failure,parser,branch,split,send],
   connections:{'Manual Trigger':{main:[[edge(context.name)]]},[context.name]:{main:[[edge(failure.name)]]},[failure.name]:{main:[[edge(parser.name)]]},[parser.name]:{main:[[edge(branch.name)]]},[branch.name]:{main:[[edge(split.name)],[]]},[split.name]:{main:[[edge(send.name)]]}},settings:{executionOrder:'v1'}};
  const fixturePath=path.join(dir,'workflow.json');fs.writeFileSync(fixturePath,JSON.stringify(fixture));
  const {stdout,stderr}=await execFileAsync('docker',['run','--rm','--entrypoint','sh','-v',`${fixturePath}:/tmp/workflow.json:ro`,'docker.n8n.io/n8nio/n8n:2.43.8','-c','n8n import:workflow --input=/tmp/workflow.json && n8n execute --id=fixture-attendance-recovery --rawOutput'],{timeout:120000,maxBuffer:4*1024*1024});
  const expected=caseName==='blocked'?0:1;
  assert.equal(received.length,expected,`Expected ${expected} outbound request(s). stdout=${stdout.slice(-1200)} stderr=${stderr.slice(-1200)}`);
  if(expected){
   assert.equal(received[0].body.number,'synthetic-test-only');
   assert.match(received[0].body.text,/N[aã]o consegui processar sua mensagem agora/);
   assert.doesNotMatch(received[0].body.text,/payjoy\.com|https?:\/\//i);
  }
  process.stdout.write(JSON.stringify({passed:true,caseName,requests:received.length,number:received[0]?.body.number,text:received[0]?.body.text,version:'2.43.8'})+'\n');
 }finally{server.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
