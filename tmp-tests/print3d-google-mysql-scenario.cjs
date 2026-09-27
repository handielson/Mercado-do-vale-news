'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {registerPrint3dGoogleAuthRoutes}=require('../services/print3dGoogleAuthServer.cjs');
const {normalizeEmail,passwordHash}=require('../services/print3dCustomerAccountsServer.cjs');
const {signPrint3dCustomerSession,verifyPrint3dCustomerSession}=require('../services/print3dCustomerSession.cjs');
module.exports=async function verifyGoogleAccounts(pool){
 const app=require('fastify')({logger:{level:'error'}});
 const secret='local-google-test-secret-more-than-32-bytes',proof='a'.repeat(64);
 const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
 const google={enabled:true,clientId:'local-3d.apps.googleusercontent.com',clientSecret:'fake',redirectUri:'https://api.example.test/print3d/auth/google/callback',mdvClientId:'local-mdv.apps.googleusercontent.com'};
 let identity;
 const authenticatedAccount=async req=>{
  const claims=verifyPrint3dCustomerSession((req.headers.authorization||'').replace(/^Bearer /,''),secret);
  if(!claims)return null;
  const [[account]]=await pool.query('SELECT c.*,a.auth_version FROM print3d_customers c JOIN print3d_customer_auth a ON a.customer_id=c.id WHERE c.id=?',[claims.customer_id]);
  return account?.is_active&&account.auth_version===claims.auth_version?account:null;
 };
 registerPrint3dGoogleAuthRoutes(app,{pool,configured:true,google,publicUrl:'https://3d.example.test',authSecret:secret,
  normalizeEmail,passwordHash,authenticatedAccount,
  guard:async(req,reply)=>{if(req.body?.captcha_token!=='local-captcha')return reply.code(400).send({error:'captcha'});},
  fetchImpl:async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert(options.body.get('code_verifier'));return {ok:true,json:async()=>({id_token:'local-fake'})};},
  verifyIdentity:async()=>identity});
 const post=(path,payload,token)=>app.inject({method:'POST',url:'/print3d/auth/google/'+path,headers:token?{authorization:'Bearer '+token}:{},payload:{...payload,captcha_token:'local-captcha'}});
 async function flow(sub,email,token){
  const prepared=await post('prepare',{browser_challenge:hash(proof),link:Boolean(token)},token);assert.equal(prepared.statusCode,200,prepared.body);
  const startUrl=new URL(prepared.json().url),started=await app.inject(startUrl.pathname+startUrl.search);
  const googleUrl=new URL(started.headers.location);assert.equal(googleUrl.origin,'https://accounts.google.com');
  identity={sub,email,name:'Cliente Google local',email_verified:true,aud:google.clientId,iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,nonce:googleUrl.searchParams.get('nonce')};
  const callback=await app.inject({url:'/print3d/auth/google/callback?code=local&state='+encodeURIComponent(googleUrl.searchParams.get('state')),headers:{cookie:started.headers['set-cookie'].split(';')[0]}});
  const destination=new URL(callback.headers.location);assert.equal(destination.origin,'https://3d.example.test');
  const code=new URLSearchParams(destination.hash.slice(1)).get('code');assert(code);
  return code;
 }
 const exchange=(code,token,verifier=proof)=>post('exchange',{code,browser_verifier:verifier},token);
 try {
  const ticket=await flow('local-google-001','local-new@gmail.com');
  assert.equal((await exchange(ticket,undefined,'b'.repeat(64))).statusCode,400);
  const parallel=await Promise.all([exchange(ticket),exchange(ticket)]);
  assert.deepEqual(parallel.map(r=>r.statusCode).sort(),[200,400]);
  const account=parallel.find(r=>r.statusCode===200).json();
  assert.equal(verifyPrint3dCustomerSession(account.token,secret).customer_id,account.customer.id);
  const repeated=await exchange(await flow('local-google-001','changed-google@gmail.com'));
  assert.equal(repeated.statusCode,200,repeated.body);assert.equal(repeated.json().customer.id,account.customer.id);
  assert.equal((await exchange(await flow('local-google-002','local-new@gmail.com'))).statusCode,409,'matching email must not merge identities automatically');
  const [[existing]]=await pool.query('SELECT c.id,a.auth_version FROM print3d_customers c JOIN print3d_customer_auth a ON a.customer_id=c.id WHERE c.email=?',['isolated-account@example.test']);
  const token=signPrint3dCustomerSession(existing.id,secret,undefined,existing.auth_version);
  const linking=await flow('local-linked-google','isolated-account@example.test',token);
  assert.equal((await exchange(linking)).statusCode,401,'link requires the same signed-in account');
  const linked=await exchange(linking,token);assert.equal(linked.statusCode,200,linked.body);assert.equal(linked.json().customer.id,existing.id);
  assert.equal((await exchange(linking,token)).statusCode,400);
  await pool.query('UPDATE print3d_customers SET is_active=0 WHERE id=?',[account.customer.id]);
  assert.equal((await exchange(await flow('local-google-001','changed-google@gmail.com'))).statusCode,403);
  const [[count]]=await pool.query("SELECT COUNT(*) total FROM print3d_customer_google WHERE google_sub IN ('local-google-001','local-google-002','local-linked-google')");
  assert.equal(Number(count.total),2);
 } finally {await app.close();}
};
