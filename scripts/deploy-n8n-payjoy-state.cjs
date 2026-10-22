'use strict';
const assert=require('node:assert/strict');
const {deployProductReadPrivacy}=require('./deploy-product-read-privacy.cjs');
const API_ENTRIES=['server.js','vps_server.js','vps_server.cjs'];
function inspectApiRuntime(processes,readFile){
 const matches=processes.filter(p=>p.name==='mdv-api');
 if(matches.length!==1)throw new Error('Expected exactly one mdv-api runtime');
 const sourceFile=matches[0].pm2_env?.pm_exec_path;
 if(!API_ENTRIES.some(file=>sourceFile===`/var/www/mdv-api/${file}`))throw new Error('Unexpected API runtime entry');
 const source=readFile(sourceFile);
 const blocks=[...source.matchAll(/const N8N_BOT_CONVERSATION_STATE_KEYS = new Set\(\[([\s\S]*?)\]\);/g)];
 return {sourceFile,apiSupportsPayjoy:blocks.length===1&&/'payjoyByJid'/.test(blocks[0][1])};
}
// Add only the known state key, preserving all other remote API code.
function patchStateKey(source){
 const regex=/const N8N_BOT_CONVERSATION_STATE_KEYS = new Set\(\[([\s\S]*?)\]\);/g;
 const matches=[...source.matchAll(regex)];assert.equal(matches.length,1,'Conversation state allowlist drift');
 const keys=[...matches[0][1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(keys.filter(k=>k!=='payjoyByJid'),['salesPostList','pendingDeviceClarification','optionalCustomerName']);
 if(keys.includes('payjoyByJid'))return source;
 return source.replace(matches[0][0],()=>matches[0][0].replace("'optionalCustomerName',","'optionalCustomerName',"+(source.includes('\r\n')?'\r\n':'\n')+"  'payjoyByJid',"));
}
async function deployPayjoyState(options){
 const runtime=inspectApiRuntime([options.apiProc],()=> '');
 assert.ok(API_ENTRIES.some(file=>runtime.sourceFile===`${options.appDir}/${file}`),'Runtime must be included in deployment');
 return deployProductReadPrivacy({...options,files:[...API_ENTRIES],
  backupPrefix:'n8n-payjoy-state',patchFile:patchStateKey});
}
module.exports={patchStateKey,deployPayjoyState,API_ENTRIES,inspectApiRuntime};
