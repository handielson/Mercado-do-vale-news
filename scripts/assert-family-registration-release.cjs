'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKERS=['Adicionar variação','Defina a variação','Salvar família e variações','SKU da variação','EAN da variação',
  'Herdar descrição do pai','Enviar vídeo','Arquivos e produção 3D','Produtos completos por lote','+ Adicionar placa'];
function assertFamilyRegistrationRelease(read) {
  const seen=new Set(),queue=['index.html'];let bundle='';
  while(queue.length){
    const file=queue.pop();if(seen.has(file))continue;seen.add(file);
    const source=read(file);if(typeof source!=='string')throw Error('Missing asset: '+file);
    if(file.endsWith('.js'))bundle+='\n'+source;
    for(const match of source.matchAll(/(?:assets\/|\.\/|["'])([A-Za-z0-9_-]+\.js)/g)){
      const next='assets/'+match[1];if(!seen.has(next))queue.push(next);
    }
  }
  const missing=MARKERS.filter(marker=>!bundle.includes(marker));
  if(missing.length)throw Error('Family registration release missing: '+missing.join(', '));
  return {files:[...seen].filter(f=>f.endsWith('.js')).length,markers:MARKERS.length};
}
if(require.main===module){const root=path.resolve(process.argv[2]||'dist');console.log(JSON.stringify(assertFamilyRegistrationRelease(file=>{const full=path.join(root,file);return fs.existsSync(full)?fs.readFileSync(full,'utf8'):undefined;})));}
module.exports={assertFamilyRegistrationRelease,MARKERS};
