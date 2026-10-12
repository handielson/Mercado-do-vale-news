'use strict';
const fs=require('node:fs'),path=require('node:path');
const hook="require('./services/openAiFinanceServer.cjs').registerOpenAiFinanceRoutes(fastify, { pool, requireAdminBearerToken });";
function patch(source){
 let next=source.replace(/\r\n/g,'\n');
 if(!next.includes(hook)){
  const anchor='async function requireSyncKeyOrCustomer(request, reply) {';
  if(next.split(anchor).length!==2||!next.includes('async function requireAdminBearerToken(request, reply)'))throw Error('Admin authentication anchor drift');
  next=next.replace(anchor,hook+'\n\n'+anchor);
 }
 const old='    openai_official_remaining_credit_usd: openAiOfficialMonthCostUsd == null\n      ? null\n      : Number((creditBalanceUsd - openAiOfficialMonthCostUsd).toFixed(6)),';
 const replacement='    openai_official_remaining_credit_usd: null,';
 if(next.includes(old)){
  if(next.split(old).length!==2)throw Error('Balance anchor ambiguous');next=next.replace(old,replacement);
 }else if(!next.includes(replacement))throw Error('Balance anchor drift');
 return next;
}
async function deploy({appDir,apiProc,exec,root,read,write,checkOnly=false}){
 if(appDir!=='/var/www/mdv-api'||apiProc.name!=='mdv-api')throw Error('Unexpected API target');
 const staged=[];
 for(const file of ['server.js','vps_server.js','vps_server.cjs']){const original=await read(appDir+'/'+file);staged.push({file,original,content:patch(original)});}
 const moduleFile='services/openAiFinanceServer.cjs';
 const exists=(await exec(`if [ -f ${appDir}/${moduleFile} ]; then printf yes; fi`)).trim()==='yes';
 staged.unshift({file:moduleFile,original:exists?await read(appDir+'/'+moduleFile):null,content:fs.readFileSync(path.join(root,moduleFile),'utf8')});
 if(checkOnly){console.log(JSON.stringify({checkOnly:true,target:appDir,files:staged.map(item=>({file:item.file,changed:item.original!==item.content}))}));return;}
 const backup=appDir+'/backups/openai-finance-'+Date.now();await exec('mkdir -p '+backup+'/services');
 for(const item of staged){await write(appDir+'/'+item.file+'.next.cjs',item.content);await exec('node --check '+appDir+'/'+item.file+'.next.cjs');}
 for(const item of staged)if(item.original!==null&&await read(appDir+'/'+item.file)!==item.original)throw Error('Remote API changed during staging');
 for(const item of staged)if(item.original!==null)await exec('cp -p '+appDir+'/'+item.file+' '+backup+'/'+item.file);
 try{
  for(const item of staged)await exec('mv '+appDir+'/'+item.file+'.next.cjs '+appDir+'/'+item.file);
  console.log((await exec('pm2 restart mdv-api')).trim());
  for(const item of staged)if(await read(appDir+'/'+item.file)!==item.content)throw Error('Remote readback mismatch');
  console.log('OpenAI finance API backup: '+backup);
 }catch(error){for(const item of staged)if(item.original!==null)await exec('cp -p '+backup+'/'+item.file+' '+appDir+'/'+item.file);await exec('pm2 restart mdv-api');throw error;}
}
module.exports={patch,deploy};
