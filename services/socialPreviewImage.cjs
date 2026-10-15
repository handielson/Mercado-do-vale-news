'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomBytes}=require('node:crypto');
const sharp=require('sharp');
const inFlight=new Map();
// Only local public media is transformed. Never fetch arbitrary URLs or mutate originals.
async function resolveSocialPreviewImage(imageUrl,{uploadsDir,allowedHosts=['api.xiaomipetrolina.com.br','www.mercadodovale.com.br','mercadodovale.com.br']}={}){
 try{
  const url=new URL(imageUrl);
  if(url.protocol!=='https:'||!allowedHosts.includes(url.hostname)||!url.pathname.startsWith('/images/')||!uploadsDir)return imageUrl;
  const root=await fs.promises.realpath(uploadsDir);
  const relative=decodeURIComponent(url.pathname.slice('/images/'.length));
  if(relative.includes('\\')||relative.includes('\0'))return imageUrl;
  const candidate=path.resolve(root,relative);
  if(!candidate.startsWith(root+path.sep))return imageUrl;
  const source=await fs.promises.realpath(candidate);
  if(!source.startsWith(root+path.sep)||!['.jpg','.jpeg','.png','.webp','.avif','.gif'].includes(path.extname(source).toLowerCase()))return imageUrl;
  const stat=await fs.promises.stat(source);if(!stat.isFile())return imageUrl;
  const version=createHash('sha256').update('social-jpeg-v1|'+source+'|'+stat.size+'|'+stat.mtimeMs).digest('hex').slice(0,16);
  const extension=path.extname(source),target=source.slice(0,-extension.length)+'-social-'+version+'.jpg';
  if(!fs.existsSync(target)){
   if(!inFlight.has(target))inFlight.set(target,(async()=>{
    const temporary=target+'.'+randomBytes(6).toString('hex')+'.tmp';
    try{
     await sharp(source,{limitInputPixels:40000000,animated:false}).rotate()
      .resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true})
      .flatten({background:'#ffffff'}).jpeg({quality:82,mozjpeg:true}).toFile(temporary);
     await fs.promises.rename(temporary,target);
    }finally{await fs.promises.unlink(temporary).catch(()=>{});}
   })().finally(()=>inFlight.delete(target)));
   await inFlight.get(target);
  }
  // Use the canonical path of the generated file, including when the input used a symlink.
  url.pathname='/images/'+path.relative(root,target).split(path.sep).map(encodeURIComponent).join('/');
  url.search='';url.hash='';return url.toString();
 }catch{return imageUrl;}
}
module.exports={resolveSocialPreviewImage};
