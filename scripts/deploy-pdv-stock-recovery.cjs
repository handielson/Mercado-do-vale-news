'use strict';
const fs=require('node:fs'),path=require('node:path');
const payload=require('./pdv-stock-recovery-api-patch.json');
const normalize=s=>s.replace(/\r\n/g,'\n');
function patch(remote) {
  const content=normalize(remote);
  if(content.includes(payload.after))return content;
  if(content.split(payload.before).length!==2)throw new Error('Rota de baixa diverge em producao; publicacao abortada.');
  return content.replace(payload.before,payload.after);
}
module.exports=async function({appDir,apiProc,exec,root,read,write}) {
  if(appDir!=='/var/www/mdv-api'||apiProc.name!=='mdv-api')throw new Error('Alvo inesperado.');
  const staged=[];
  for(const file of ['server.js','vps_server.js','vps_server.cjs']) {
    const original=await read(appDir+'/'+file);staged.push({file,original,content:patch(original)});
  }
  for(const file of ['services/priorityStockDecrement.cjs','services/saleStockReconciliation.cjs']) {
    const original=await read(appDir+'/'+file),content=fs.readFileSync(path.join(root,file),'utf8');
    const expected=file.includes('priorityStockDecrement')?payload.helperBefore:'';
    if(normalize(original)!==normalize(expected)&&normalize(original)!==normalize(content))throw new Error('Helper diverge em producao: '+file);
    staged.push({file,original,content});
  }
  const backup=appDir+'/backups/pdv-stock-recovery-'+Date.now();await exec('mkdir -p '+backup+'/services');
  for(const s of staged){await write(appDir+'/'+s.file+'.next.cjs',s.content);await exec('node --check '+appDir+'/'+s.file+'.next.cjs');}
  for(const s of staged)if(await read(appDir+'/'+s.file)!==s.original)throw new Error('API mudou durante a publicacao.');
  for(const s of staged)if(s.original)await exec('cp -p '+appDir+'/'+s.file+' '+backup+'/'+s.file);
  // Helpers primeiro: todas as entradas do servidor usam a mesma implementacao.
  for(const s of [...staged.slice(3),...staged.slice(0,3)])await exec('mv '+appDir+'/'+s.file+'.next.cjs '+appDir+'/'+s.file);
  console.log(await exec('pm2 restart mdv-api'));console.log('Backup: '+backup);
};
module.exports.patch=patch;
