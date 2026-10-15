'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const BASELINE='7cee11f2';
const normalize=value=>value.replace(/\r\n/g,'\n');
const SPECS=[
  ['function decideN8nBotConversationStateWrite(', '\n}\n'],
  ['async function notifyCustomerDeliveryCompleted(', '\n}\n','async function withCustomerDeliveryNotificationLock('],
  ['async function notifyCustomerDeliveryOutForDelivery(', '\n}\n'],
  ['function getCustomerDeliveryCompletionBlockers(', '\n}\n'],
  ['async function completeCustomerDeliveryJob(', '\n}\n'],
  ["fastify.post('/n8n-bot/client-control/handoff'",'\n});'],
  ["fastify.post('/n8n-bot/client-control/conversation-state'",'\n});'],
  ["fastify.get('/delivery/app/jobs'",'\n});','function buildDeliveryAppDateFilter('],
  ["fastify.get('/delivery/app/dashboard'",'\n});'],
  ["fastify.post('/delivery/jobs/:token/start-route'",'\n});'],
  ["fastify.post('/delivery/jobs/:token/complete'",'\n});'],
  ["fastify.post('/delivery/jobs/:token/admin-complete'",'\n});'],
  ["fastify.get('/status'",'\n});'],
];
function block(source,[anchor,closing,prefix]){
  if(source.split(anchor).length!==2)throw Error('Missing/ambiguous scoped anchor: '+anchor);
  const main=source.indexOf(anchor),end=source.indexOf(closing,main);
  if(end<0)throw Error('Missing scoped block closing');
  const start=prefix&&source.includes(prefix)?source.indexOf(prefix):main;
  if(start>main||prefix&&source.split(prefix).length>2)throw Error('Ambiguous helper prefix');
  return source.slice(start,end+closing.length);
}
function patch(remote,baseline,current){
  const old=normalize(baseline),next=normalize(current);let result=normalize(remote),accounted=old;
  for(const spec of SPECS){
    const before=block(old,spec),after=block(next,spec);
    if(before===after)continue;
    const found=block(result,spec);
    if(found!==before&&found!==after)throw Error('Remote sales/delivery drift: '+spec[0]);
    result=result.replace(found,after);accounted=accounted.replace(before,after);
  }
  if(accounted!==next)throw Error('Unaccounted local API changes outside sales/delivery scope');
  return remote.includes('\r\n')?result.replace(/\n/g,'\r\n'):result;
}
async function deploy(options){
  const baseline=file=>execFileSync('git',['show',BASELINE+':'+file],{cwd:options.root,encoding:'utf8',maxBuffer:15e6});
  const oldEntry=baseline('vps_server.cjs'),current=fs.readFileSync(path.join(options.root,'vps_server.cjs'),'utf8');
  const oldJs=baseline('vps_server.js'),currentJs=fs.readFileSync(path.join(options.root,'vps_server.js'),'utf8');
  // Both representations must account for their own delta without forcing unrelated parity.
  patch(oldJs,oldJs,currentJs);
  const moduleFile='services/n8nAdminHandoffRelay.cjs';
  const remoteModule=await options.read(options.appDir+'/'+moduleFile);
  if(![normalize(baseline(moduleFile)),normalize(fs.readFileSync(path.join(options.root,moduleFile),'utf8'))].includes(normalize(remoteModule)))throw Error('Remote handoff module drift');
  return require('./deploy-openai-finance.cjs').deploy({...options,moduleFiles:[moduleFile],backupSlug:'sales-delivery',patchSource:remote=>patch(remote,oldEntry,current)});
}
module.exports={BASELINE,SPECS,block,patch,deploy};
