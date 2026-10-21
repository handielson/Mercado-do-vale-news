'use strict';
const assert=require('node:assert/strict');
const {deployProductReadPrivacy}=require('./deploy-product-read-privacy.cjs');
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
 return deployProductReadPrivacy({...options,files:['vps_server.js','vps_server.cjs'],
  backupPrefix:'n8n-payjoy-state',patchFile:patchStateKey});
}
module.exports={patchStateKey,deployPayjoyState};
