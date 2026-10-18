'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {patchWhatsAppWebhookAck,ACK_NAME}=require('../scripts/n8n-whatsapp-webhook-ack.cjs');
// Self-contained transport fixture; an explicit incident export can also be used.
const edge=node=>({node,type:'main',index:0});
const source=process.env.MDV_WEBHOOK_SNAPSHOT
 ? JSON.parse(require('node:fs').readFileSync(process.env.MDV_WEBHOOK_SNAPSHOT,'utf8')).workflow
 : {nodes:[
  {name:'Webhook',type:'n8n-nodes-base.webhook',position:[0,0],parameters:{path:'whatsapp',httpMethod:'POST',options:{}}},
  {name:'Business',type:'n8n-nodes-base.if',parameters:{}},
  {name:'Meta - Webhook Atendimento',type:'n8n-nodes-base.webhook',parameters:{path:'meta-attendance',responseMode:'responseNode'}},
  {name:'Meta - Responder webhook',type:'n8n-nodes-base.respondToWebhook',parameters:{respondWith:'firstIncomingItem',options:{responseCode:200}}},
 ],connections:{Webhook:{main:[[edge('Business')]]},Business:{main:[[],[edge('Meta - Responder webhook')]]},'Meta - Webhook Atendimento':{main:[[edge('Meta - Responder webhook')]]}}};
function descendants(w,start){const found=new Set(),todo=[start];while(todo.length){const name=todo.pop();if(found.has(name))continue;found.add(name);for(const outputs of Object.values(w.connections[name]||{}))for(const edges of outputs)for(const edge of edges)todo.push(edge.node);}found.delete(start);return [...found].map(name=>w.nodes.find(n=>n.name===name));}
function validate(w){for(const hook of w.nodes.filter(n=>n.type==='n8n-nodes-base.webhook')){const responders=descendants(w,hook.name).filter(n=>n.type==='n8n-nodes-base.respondToWebhook');if(responders.length)assert.equal(hook.parameters.responseMode,'responseNode',hook.name);}}
test('incident composition reproduces structural response validation failure across conditional outputs',()=>assert.throws(()=>validate(source),/Webhook/));
test('candidate passes response validation for both webhook entrypoints',()=>validate(patchWhatsAppWebhookAck(source)));
test('WhatsApp responds before original first business node and preserves old response',()=>{
 const w=patchWhatsAppWebhookAck(source),ack=w.nodes.find(n=>n.name===ACK_NAME);
 assert.deepEqual(w.connections.Webhook.main,[[{node:ACK_NAME,type:'main',index:0}]]);
 assert.deepEqual(w.connections[ACK_NAME],source.connections.Webhook);
 assert.equal(ack.parameters.respondWith,'json');assert.deepEqual(JSON.parse(ack.parameters.responseBody),{message:'Workflow was started'});assert.equal(ack.parameters.options.responseCode,200);
});
test('Meta cannot reach WhatsApp ACK; Meta response and all business nodes/edges unchanged',()=>{
 const before=JSON.stringify(source),w=patchWhatsAppWebhookAck(source);
 assert.equal(JSON.stringify(source),before);
 assert.ok(!descendants(w,'Meta - Webhook Atendimento').some(n=>n.name===ACK_NAME));
 for(const n of source.nodes){const actual=w.nodes.find(x=>x.name===n.name);if(n.name==='Webhook'){const expected=structuredClone(n);expected.parameters.responseMode='responseNode';assert.deepEqual(actual,expected);}else assert.deepEqual(actual,n);}
 for(const [name,edges]of Object.entries(source.connections))if(name!=='Webhook')assert.deepEqual(w.connections[name],edges);
 assert.deepEqual(patchWhatsAppWebhookAck(w),w);
});
