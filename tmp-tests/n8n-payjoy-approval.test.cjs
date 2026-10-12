const assert=require('node:assert/strict'),fs=require('fs');
const p=require('./n8n-payjoy-approval-patch.cjs');
const original=JSON.parse(fs.readFileSync(process.env.MDV_PAYJOY_WORKFLOW_SNAPSHOT,'utf8'));
const w=p.patchWorkflow(original);assert.deepEqual(p.patchWorkflow(w),w);p.validate(w);
const code=name=>w.nodes.find(n=>n.name===name).parameters.jsCode;
const jid='fixture@s.whatsapp.net';
const state=()=>({payjoyByJid:{[jid]:{status:'awaiting_result',updatedAt:Date.now()}},salesPostList:{[jid]:{selectedOptionNumber:20,options:[{number:20,name:'Note 70'}]}}});
function run(name,json,s,source={remoteJid:jid}){return new Function('$json','$','$getWorkflowStaticData',code(name))(json,()=>({first:()=>({json:source})}),()=>s)[0]?.json;}
const approval={isPayjoyResult:true,approvalStatus:'approved',legible:true,approvedAmount:1600,entryPercent:14};
let s=state(),r=run('PayJoy - Calcular entrada do print',{content:JSON.stringify(approval)},s,{remoteJid:jid,payjoyImageBase64:'secret-image'});
assert.equal(r.payjoyCalculation.entryCents,22400);assert.match(r.output,/224,00/);assert.match(r.output,/Note 70/);assert.equal(r.payjoyImageBase64,undefined);
assert.equal(s.payjoyByJid[jid].approvedAmountCents,160000);
for(const result of [{...approval,legible:false},{...approval,isPayjoyResult:false},{...approval,approvalStatus:'denied'}]){r=run('PayJoy - Calcular entrada do print',{content:JSON.stringify(result)},state());assert.equal(r.payjoyCalculation,undefined);assert.doesNotMatch(r.output,/224,00/);}
for(const content of ['garbage','',JSON.stringify({error:'429'})])assert.doesNotMatch(run('PayJoy - Calcular entrada do print',{content},state()).output,/224,00/);
r=run('PayJoy - Calcular entrada do print',{content:JSON.stringify({...approval,entryPercent:null})},state());assert.equal(r.payjoyCalculation.entryCents,null);assert.match(r.output,/Qual percentual/);
for(const question of ['Aprovou R$ 1.600,00 com entrada de 14%','Valor aprovado 1600, entrada 14%']){r=run('Pagamento - Politica',{},state(),{remoteJid:jid,conversation:question});assert.equal(r.payjoyCalculation.entryCents,22400);assert.match(r.output,/224,00/);}
s=state();run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'Valor aprovado 1600'});r=run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'14%'});assert.equal(r.payjoyCalculation.entryCents,22400);
s=state();run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'14%'});r=run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'R$ 1.600,00'});assert.equal(r.payjoyCalculation.entryCents,22400);
s=state();run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'Valor aprovado 1600'});r=run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'14'});assert.equal(r.payjoyCalculation.entryCents,22400);
assert.equal(p.calculateEntry({entryPercent:101},{approvedAmountCents:160000,entryPercentBp:1400}).entryCents,null);
assert.equal(p.calculateEntry({approvedAmount:0,entryPercent:14}).entryCents,null);
assert.equal(p.calculateEntry({approvedAmount:1600,entryPercent:0}).entryCents,0);
assert.equal(p.parseText('14% ou 20%').ambiguous,true);assert.equal(p.parseText('entrada -14%').ambiguous,true);
assert.equal(p.parseText('A PayJoy aprovou 14% de entrada').approvedAmount,null);
assert.equal(p.parseText('Valor aprovado 1600 com 1000% de entrada').entryPercent,1000);
assert.equal(p.calculateEntry(p.parseText('Valor aprovado 1600 com 1000% de entrada')).entryCents,null);
for(const question of ['Fui reprovada mas entrada 14%','Desconto de 14% pela PayJoy']){r=run('Pagamento - Politica',{},state(),{remoteJid:jid,conversation:question});assert.equal(r.payjoyCalculation,undefined);}
for(const status of ['declined','denied']){s=state();s.payjoyByJid[jid].status=status;r=run('Pagamento - Politica',{},s,{remoteJid:jid,conversation:'14%'});assert.equal(r.payjoyCalculation,undefined);}
assert.deepEqual(p.parseText('CPF 12345678901'),{approvedAmount:null,entryPercent:null});
const human=w.connections['Controle Bot - Bloqueado?'].main;assert.deepEqual(human[0],original.connections['Controle Bot - Bloqueado?'].main[0]);assert.equal(human[1][0].node,'PayJoy - Recebeu print?');
const event={body:{data:{key:{remoteJid:jid,fromMe:false,id:'synthetic'},messageType:'imageMessage',message:{imageMessage:{mimetype:'image/png',base64:'aGVsbG8='}}}}};
r=run('Dados',event,state());assert.equal(r.payjoyPrint,true);assert.equal(r.messageType,'conversation');assert.equal(r.remoteJid,jid);
r=run('Dados',event,{});assert.equal(r.payjoyPrint,undefined);assert.equal(r.messageType,'imageMessage');
const own=structuredClone(event);own.body.data.key.fromMe=true;r=run('Dados',own,state());assert.equal(r.payjoyPrint,undefined);
const caption=structuredClone(event);caption.body.data.message.imageMessage.caption='Quero falar com atendente';r=run('Dados',caption,state());assert.equal(r.payjoyPrint,false);assert.equal(r.messageType,'conversation');assert.equal(r.conversation,'Quero falar com atendente');
s=state();s.payjoyByJid[jid].approvedAmountCents=160000;s.payjoyByJid[jid].entryPercentBp=1400;run('PayJoy - Calcular entrada do print',{content:JSON.stringify({...approval,approvalStatus:'denied'})},s);assert.equal(s.payjoyByJid[jid].status,'denied');assert.equal(s.payjoyByJid[jid].approvedAmountCents,undefined);
const copy=code('Pagamento - Politica');assert.equal(copy.split('Envie um print desse resultado').length-1,2);assert.match(copy,/valor aprovado e o percentual de entrada/);
const credentials=w.nodes.find(n=>n.name==='PayJoy - Ler aprovacao').credentials;assert.deepEqual(credentials,original.nodes.find(n=>n.name==='OpenAI Vendas').credentials);
console.log('PayJoy print/text extraction, 1600 x 14%=224, partial replies, negative/illegible/ambiguous values, image scope, human pause and graph/idempotence passed');
