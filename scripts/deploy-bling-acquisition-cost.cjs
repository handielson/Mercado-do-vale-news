const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const normalize=s=>s.replace(/\r\n/g,'\n');
function sections(s) {
  const fn=s.match(/function readBlingCostPriceForWebhookVps\([^]*?\n}/)?.[0];
  const condition=s.split('\n').find(l=>l.includes('if (accessToken && blingId && (!resolvedName || !resolvedSku'));
  if(!fn||!condition)throw new Error('Seção de custo Bling ausente.');
  return [fn,condition];
}
function patch(remote,before,after) {
  let content=normalize(remote);const old=sections(normalize(before)),next=sections(normalize(after));
  old.forEach((s,i)=>{if(content.includes(next[i]))return;if(content.split(s).length!==2)throw new Error('Custo Bling diverge em produção; publicação abortada.');content=content.replace(s,next[i]);});
  return content;
}
module.exports=async function({appDir,apiProc,exec,root,read,write}) {
  if(appDir!=='/var/www/mdv-api'||apiProc.name!=='mdv-api')throw new Error('Alvo inesperado.');
  const before=execFileSync('git',['show','HEAD^:vps_server.js'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  const after=fs.readFileSync(path.join(root,'vps_server.js'),'utf8');
  const staged=[];
  for(const file of ['server.js','vps_server.js','vps_server.cjs']) {const original=await read(appDir+'/'+file);staged.push({file,original,content:patch(original,before,after)});}
  const backup=appDir+'/backups/bling-acquisition-cost-'+Date.now();await exec('mkdir -p '+backup);
  for(const s of staged) {await write(appDir+'/'+s.file+'.next.cjs',s.content);await exec('node --check '+appDir+'/'+s.file+'.next.cjs');}
  for(const s of staged) if(await read(appDir+'/'+s.file)!==s.original)throw new Error('API mudou durante a publicação.');
  for(const s of staged) {await exec('cp -p '+appDir+'/'+s.file+' '+backup+'/'+s.file);await exec('mv '+appDir+'/'+s.file+'.next.cjs '+appDir+'/'+s.file);}
  console.log(await exec('pm2 restart mdv-api'));console.log('Backup do custo Bling: '+backup);
};
module.exports.patch=patch;
