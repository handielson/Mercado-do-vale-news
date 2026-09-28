'use strict';
// Local storefront gateway. The central API remains authoritative for customer
// identity, prices and stock. No admin credentials or generic CRUD are forwarded.
const AUTH_POST = new Set(['register','verification/request','verify-email','login','password/request','password/reset',
  'phone/register/request','phone/register/verify','phone/request','phone/verify','phone/confirm',
  'password/phone/request','password/phone/verify','password/phone/confirm','google/prepare','google/exchange']);
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const orderPath=new RegExp(`^/print3d/orders/${UUID}(?:/payment)?$`,'i');
const orderAction=new RegExp(`^/print3d/orders/${UUID}/(?:payment|payment/refresh|cancel)$`,'i');
function targetPath(raw,method) {
  if(typeof raw!=='string'||raw.length>2048||!raw.startsWith('/')||/[\\#%]/.test(raw)||raw.startsWith('//')) return null;
  const target=new URL(raw,'http://local.invalid');
  if(target.pathname!==raw.split('?')[0]) return null;
  const p=target.pathname,q=target.searchParams;
  let keys=[];
  if(method==='GET') {
    if(p==='/banners') {if(q.get('storefront')!=='loja_3d')return null;keys=['storefront'];}
    else if(p==='/categories') keys=[];
    else if(p==='/storefronts/loja_3d/products') {
      keys=['limit'];if(q.has('limit')&&!/^(?:[1-9][0-9]{0,2}|1[0-9]{3}|2000)$/.test(q.get('limit')))return null;
    } else if(!['/print3d/auth/me','/print3d/auth/google/config','/print3d/auth/phone/status',
      '/print3d/checkout','/print3d/orders','/print3d/production'].includes(p)&&!orderPath.test(p)) return null;
  } else if(method==='POST') {
    if(p.startsWith('/print3d/auth/')) {if(!AUTH_POST.has(p.slice('/print3d/auth/'.length)))return null;}
    else if(!['/print3d/checkout','/storefronts/loja_3d/quote','/storefronts/loja_3d/shipping/quote','/storefronts/loja_3d/deadline-requests'].includes(p)&&!orderAction.test(p)) return null;
  } else return null;
  for(const key of q.keys()) if(!keys.includes(key)||q.getAll(key).length!==1)return null;
  return target.pathname+target.search;
}
function createPrint3dPublicProxy({apiOrigin,fetchImpl=globalThis.fetch}={}) {
  let origin;
  if(apiOrigin) {
    origin=new URL(apiOrigin);
    if(origin.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(origin.hostname)||origin.username||origin.password
      ||origin.pathname!=='/'||origin.search||origin.hash) throw new Error('A API de teste 3D deve usar origem HTTP loopback explícita.');
  }
  return async function proxy(req,res,next) {
    const outer=new URL(req.url,'http://local.invalid');
    if(!['/vps-proxy','/api/vps-proxy'].includes(outer.pathname))return next();
    const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
    const raw=outer.searchParams.get('path');
    const path=targetPath(raw,req.method);
    if(!path||outer.searchParams.getAll('path').length!==1||[...outer.searchParams.keys()].some(k=>k!=='path'))return send(403,{error:'Rota não disponível na loja 3D.'});
    if(!origin)return send(503,{error:'API da loja 3D não configurada neste ambiente local.'});
    try {
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Origem inválida.'});
      let body;
      if(req.method==='POST') {
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'Envie JSON.'});
        const chunks=[];let length=0;
        for await(const chunk of req){length+=chunk.length;if(length>65536)return send(413,{error:'Solicitação muito grande.'});chunks.push(chunk);}
        body=Buffer.concat(chunks).toString('utf8');
        try {const value=JSON.parse(body);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}catch{return send(400,{error:'JSON inválido.'});}
      }
      const headers={'Content-Type':'application/json'};
      if(path.startsWith('/print3d/')&&typeof req.headers.authorization==='string')headers.Authorization=req.headers.authorization;
      const upstream=await fetchImpl(new URL(path,origin),{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!/^application\/json(?:;|$)/i.test(upstream.headers.get('content-type')||''))throw Error('Unexpected response');
      const chunks=[];let length=0;
      for await(const chunk of upstream.body){length+=chunk.length;if(length>4194304)throw Error('Response too large');chunks.push(Buffer.from(chunk));}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      return send(upstream.status,data);
    } catch {return send(502,{error:'Não foi possível consultar a API da loja 3D.'});}
  };
}
module.exports={targetPath,createPrint3dPublicProxy};
