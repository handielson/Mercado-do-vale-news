'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {ENTRIES,ROUTES,block,assertCatalogMediaContract}=require('./assert-catalog-media-contract.cjs');
const BASELINE='5e9e8f60';
const normalize=s=>s.replace(/\r\n/g,'\n');
const HELPER='function productFamilyNameSelectSql(';
function versions(root){return ENTRIES.map(file=>({file,before:normalize(execFileSync('git',['show',BASELINE+':'+file],{cwd:root,encoding:'utf8',maxBuffer:15e6})),after:normalize(fs.readFileSync(path.join(root,file),'utf8'))}));}
function patch(remote,choices){
 let out=normalize(remote);
 for(const anchor of [...ROUTES.map(route=>"fastify.get('"+route+"',"),"fastify.get('/api/seo-produto',","fastify.get('/api/seo-produto-3d',"]){
  if(!out.includes(anchor)){if(anchor.includes('seo-produto-3d'))continue;throw Error('Remote route missing: '+anchor);}
  const found=block(out,anchor);const candidates=choices.filter(v=>v.before.includes(anchor));
  if(candidates.some(v=>block(v.after,anchor)===found))continue;
  const match=candidates.find(v=>block(v.before,anchor)===found);
  if(!match)throw Error('Remote catalog media drift: '+anchor);
  out=out.replace(found,()=>block(match.after,anchor));
 }
 const target=block(choices[0].after,HELPER,'\n}');
 if(out.includes(HELPER)){
  const found=block(out,HELPER,'\n}');
  if(found!==target&&!choices.some(v=>v.before.includes(HELPER)&&block(v.before,HELPER,'\n}')===found))throw Error('Remote family helper drift');
  out=out.replace(found,()=>target);
 }else out=out.replace("fastify.get('/products',",()=>target+"\n\nfastify.get('/products',");
 return remote.includes('\r\n')?out.replace(/\n/g,'\r\n'):out;
}
async function deploy(options){
 assertCatalogMediaContract(file=>fs.readFileSync(path.join(options.root,file),'utf8'));
 const choices=versions(options.root);
 for(const v of choices)if(normalize(patch(v.before,choices))!==v.after)throw Error('Unaccounted local media API delta: '+v.file);
 return require('./deploy-openai-finance.cjs').deploy({...options,moduleFiles:['services/socialPreviewImage.cjs'],backupSlug:'catalog-media',patchSource:source=>patch(source,choices)});
}
module.exports={BASELINE,versions,patch,deploy};
