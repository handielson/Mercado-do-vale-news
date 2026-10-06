'use strict';
const fs=require('node:fs'),path=require('node:path');
const patches=require('./families-units-api-patch.json');
const normalize=s=>s.replace(/\r\n/g,'\n');
function patch(remote) {
  let content=normalize(remote);
  for(const p of patches){if(content.includes(p.after))continue;if(content.split(p.before).length!==2)throw new Error('API diverge do contexto esperado; nenhum arquivo ativo foi alterado.');content=content.replace(p.before,p.after);}
  return content;
}
module.exports=async function({appDir,apiProc,exec,root,read,write}) {
  if(appDir!=='/var/www/mdv-api'||apiProc.name!=='mdv-api')throw new Error('Alvo inesperado.');
  const staged=[];
  for(const file of ['server.js','vps_server.js','vps_server.cjs']) {const original=await read(appDir+'/'+file);staged.push({file,original,content:patch(original)});}
  const helper='services/unitVisibility.cjs';const content=fs.readFileSync(path.join(root,helper),'utf8');
  const backup=appDir+'/backups/families-units-'+Date.now();await exec('mkdir -p '+backup+'/services');
  await write(appDir+'/'+helper+'.next.cjs',content);await exec('node --check '+appDir+'/'+helper+'.next.cjs');
  for(const s of staged) {await write(appDir+'/'+s.file+'.next.cjs',s.content);await exec('node --check '+appDir+'/'+s.file+'.next.cjs');}
  for(const s of staged) if(await read(appDir+'/'+s.file)!==s.original)throw new Error('API mudou durante a publicação.');
  for(const s of staged) await exec('cp -p '+appDir+'/'+s.file+' '+backup+'/'+s.file);
  await exec('if test -f '+appDir+'/'+helper+'; then cp -p '+appDir+'/'+helper+' '+backup+'/'+helper+'; fi');
  await exec('mv '+appDir+'/'+helper+'.next.cjs '+appDir+'/'+helper);
  for(const s of staged) await exec('mv '+appDir+'/'+s.file+'.next.cjs '+appDir+'/'+s.file);
  console.log(await exec('pm2 restart mdv-api'));console.log('Backup: '+backup);
};
module.exports.patch=patch;
