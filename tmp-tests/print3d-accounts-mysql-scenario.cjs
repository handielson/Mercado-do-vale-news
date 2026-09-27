'use strict';
const assert=require('node:assert/strict');
const {registerPrint3dCustomerAccountRoutes}=require('../services/print3dCustomerAccountsServer.cjs');
const {createPrint3dAuthSecurity}=require('../services/print3dAuthSecurity.cjs');
module.exports=async function verifyAccounts(pool){
 const app=require('fastify')({logger:{level:'error'}}),mails=[],messages=[];
 let phoneClock=Date.now();
 const secret='local-only-test-secret-32-characters-minimum';
 const security=createPrint3dAuthSecurity({pool,secret,publicUrl:'https://3d.example.test',turnstileSecret:'local-fake',
  fetchImpl:async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
   assert.equal(JSON.parse(options.body).response,'local-captcha');
   return {ok:true,json:async()=>({success:true,hostname:'3d.example.test',action:'print3d_auth'})};}});
 const accounts=registerPrint3dCustomerAccountRoutes(app,{pool,authSecret:secret,enabled:true,publicUrl:'https://3d.example.test',
  fromEmail:'contato@3d.example.test',brandName:'Loja 3D de Teste',security,
  phoneEnabled:true,phoneNow:()=>phoneClock,sendWhatsApp:async(phone,message)=>{messages.push({phone,message});return {ok:true};},
  sendEmail:async mail=>{mails.push(mail);return {sent:true};}});
 const verifyCheckout=await require('./print3d-account-checkout-mysql.cjs')({pool,app,getCustomer:accounts.getCustomer});
 const post=(path,payload)=>app.inject({method:'POST',url:'/print3d/auth/'+path,payload:{...payload,captcha_token:'local-captcha'}});
 const email='isolated-account@example.test',password='Original-test-password-123',newPassword='Recovered-test-password-456';
 const login=pass=>post('login',{identifier_type:'email',identifier:email,password:pass});
 const me=token=>app.inject({url:'/print3d/auth/me',headers:{authorization:'Bearer '+token}});
 const mailedToken=()=>{const link=mails.at(-1).text.match(/https:\/\/[^\s]+/)[0];assert.equal(new URL(link).hostname,'3d.example.test');return new URL(link).searchParams.get('token');};
 try {
  const created=await post('register',{name:'Conta independente',verification_method:'email',email,password});
  assert.equal(created.statusCode,202,created.body);assert.equal(mails.length,1);
  assert.equal((await login(password)).statusCode,401,'unverified account must not log in');
  const verificationToken=mailedToken();
  assert.equal((await post('verify-email',{token:verificationToken})).statusCode,200);
  assert.equal((await post('verify-email',{token:verificationToken})).statusCode,400,'verification proof is single use');
  const signedIn=await login(password);assert.equal(signedIn.statusCode,200,signedIn.body);
  const oldToken=signedIn.json().token;assert.equal((await me(oldToken)).statusCode,200);
  assert.equal((await me('legacy-mdv-token')).statusCode,401);
  const [header,payload]=oldToken.split('.');
  const mdvSignature=require('node:crypto').createHmac('sha256',secret).update(`${header}.${payload}`).digest('base64url');
  assert.equal((await me(`${header}.${payload}.${mdvSignature}`)).statusCode,401,'valid raw-secret MDV signature cannot authenticate a 3D account');
  const [[auth]]=await pool.query('SELECT a.password_hash,a.salt,a.auth_version FROM print3d_customer_auth a JOIN print3d_customers c ON c.id=a.customer_id WHERE c.email=?',[email]);
  assert.notEqual(auth.password_hash,password);assert.equal(auth.password_hash.length,128);
  for(let n=0;n<5;n++)assert.equal((await login('wrong-password-123')).statusCode,401);
  const blocked=await login(password);assert.equal(blocked.statusCode,429);assert.equal(blocked.headers['retry-after'],'900');
  assert.equal((await post('password/request',{email})).statusCode,202,'recovery is available during lockout');
  assert.equal(mails.length,2);const resetToken=mailedToken();
  assert.equal((await post('password/reset',{token:resetToken,password:newPassword})).statusCode,200);
  assert.equal((await me(oldToken)).statusCode,401,'password reset invalidates previous sessions');
  const recovered=await login(newPassword);assert.equal(recovered.statusCode,200,recovered.body);
  assert.equal((await me(recovered.json().token)).statusCode,200);
  assert.equal((await post('password/reset',{token:resetToken,password:newPassword})).statusCode,400);
  assert.equal((await login(password)).statusCode,401);
  const [[updated]]=await pool.query('SELECT a.auth_version FROM print3d_customer_auth a JOIN print3d_customers c ON c.id=a.customer_id WHERE c.email=?',[email]);
  assert.equal(updated.auth_version,auth.auth_version+1);

  const phone='5587998765432',cpf='52998224725';
  const phoneCode=()=>messages.at(-1).message.match(/\b[0-9]{6}\b/)[0];
  const challenge=await post('phone/register/request',{phone});assert.equal(challenge.statusCode,200,challenge.body);
  assert.equal(messages.length,1);assert.equal(messages[0].phone,phone);assert(!messages[0].message.includes('Mercado do Vale'));
  const challengeId=challenge.json().challenge_id,code=phoneCode();
  const wrongCode=code==='000000'?'111111':'000000';
  assert.equal((await post('phone/register/verify',{challenge_id:challengeId,code:wrongCode})).statusCode,400);
  const verifiedPhone=await post('phone/register/verify',{challenge_id:challengeId,code});
  assert.equal(verifiedPhone.statusCode,200,verifiedPhone.body);
  const proof=verifiedPhone.json().phone_verification_token;
  const registration={name:'Cliente WhatsApp local',verification_method:'whatsapp',phone,cpf,password,phone_verification_token:proof};
  assert.equal((await post('register',{...registration,phone:'5587998765433'})).statusCode,400,'proof must bind to its phone');
  const phoneAccount=await post('register',registration);assert.equal(phoneAccount.statusCode,200,phoneAccount.body);
  assert.equal(phoneAccount.json().customer.email,null);assert.equal(mails.length,2,'phone account must not send email');
  assert.equal((await me(phoneAccount.json().token)).statusCode,200);
  assert.equal((await post('register',registration)).statusCode,400,'registration proof cannot be reused');
  const phoneLogin=(type,identifier,pass=password)=>post('login',{identifier_type:type,identifier,password:pass});
  assert.equal((await phoneLogin('phone',phone)).statusCode,200);
  assert.equal((await phoneLogin('cpf',cpf)).statusCode,200);
  const [[persistedPhone]]=await pool.query('SELECT email,phone,phone_verified_at FROM print3d_customers WHERE id=?',[phoneAccount.json().customer.id]);
  assert.equal(persistedPhone.email,null);assert.equal(persistedPhone.phone,phone);assert(persistedPhone.phone_verified_at);
  for(let n=0;n<5;n++)assert.equal((await phoneLogin(n%2?'cpf':'phone',n%2?cpf:phone,'wrong-password-123')).statusCode,401);
  assert.equal((await phoneLogin('cpf',cpf)).statusCode,429,'phone and CPF share the same account lock');
  phoneClock+=61000; // SMS/WhatsApp resend cooldown, not the 15-minute login lock.
  const recoveryChallenge=await post('password/phone/request',{phone});assert.equal(recoveryChallenge.statusCode,202,recoveryChallenge.body);
  const resetVerified=await post('password/phone/verify',{phone,challenge_id:recoveryChallenge.json().challenge_id,code:phoneCode()});
  assert.equal(resetVerified.statusCode,200,resetVerified.body);
  const phoneReset={phone,password:newPassword,phone_verification_token:resetVerified.json().phone_verification_token};
  assert.equal((await post('password/phone/confirm',phoneReset)).statusCode,200);
  assert.equal((await me(phoneAccount.json().token)).statusCode,401);
  assert.equal((await phoneLogin('phone',phone,newPassword)).statusCode,200);
  assert.equal((await phoneLogin('cpf',cpf,newPassword)).statusCode,200);
  assert.equal((await post('password/phone/confirm',phoneReset)).statusCode,400);
  const finalPhoneLogin=await phoneLogin('phone',phone,newPassword);
  await verifyCheckout({emailToken:recovered.json().token,phoneToken:finalPhoneLogin.json().token,phoneCustomerId:phoneAccount.json().customer.id});
  if(process.env.PRINT3D_MYSQL_ACCOUNT_BROWSER==='1') await require('./print3d-accounts-mysql-browser.cjs')({app,pool,mails,messages,productId:verifyCheckout.productId,approvePayment:verifyCheckout.approvePayment});
 } finally {await app.close();}
};
