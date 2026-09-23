// Creates only a disposable local Docker MySQL. Never reads application .env.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const Fastify = require('fastify');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const { normalizeLookup } = require('../services/companyFiscalCore.cjs');
const docker = (...args) => execFileSync('docker', ['--context','desktop-linux',...args], { encoding:'utf8', timeout:args[0]==='run'?180000:15000, windowsHide:true, stdio:['ignore','pipe','pipe'] }).trim();

test('MySQL real: migration, isolamento, persistência, concorrência e rollback', { timeout:300000 }, async t => {
  const name = `mdv-fiscal-test-${randomUUID()}`;
  const password = randomUUID();
  let pool, app, container;
  t.after(async () => {
    try { if (app) await app.close(); }
    finally { try { if (pool) await pool.end(); } finally { if (container) docker('rm','-f','-v',container); } }
  });
  try {
    const context = JSON.parse(docker('context','inspect','desktop-linux'))[0];
    assert.equal(context.Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine','Somente Docker Desktop local é permitido');
    docker('info','--format','{{.ServerVersion}}');
  }
  catch { throw new Error('Docker local indisponível. Inicie o Docker Desktop e repita; nenhum banco externo foi acessado.'); }
  try {
    container = docker('run','--rm','-d','--name',name,'-e',`MYSQL_ROOT_PASSWORD=${password}`,'-e','MYSQL_ROOT_HOST=%','-e','MYSQL_DATABASE=mdv_fiscal_test','-p','127.0.0.1::3306','mysql:8.4');
  } catch { throw new Error('Não foi possível iniciar a imagem MySQL local. Confira Docker e acesso ao registry.'); }
  const port = Number(docker('port',container,'3306/tcp').split(':').pop());
  assert(Number.isInteger(port) && port > 0);
  const config = {host:'127.0.0.1',port,user:'root',password,database:'mdv_fiscal_test',connectionLimit:5};
  let ready = false;
  for(let n=0;n<60;n++) {
    try { const c=await mysql.createConnection(config);await c.end();ready=true;break; }
    catch { await new Promise(r=>setTimeout(r,1000)); }
  }
  assert(ready,'MySQL local não ficou pronto em 60 segundos');
  pool = mysql.createPool(config);
  await pool.query(`CREATE TABLE company_settings (id CHAR(36) PRIMARY KEY, cnpj VARCHAR(14),name VARCHAR(255),company_name VARCHAR(255),razao_social VARCHAR(255),state_registration VARCHAR(30),cnae VARCHAR(255),porte VARCHAR(80),phone VARCHAR(30),email VARCHAR(255),social_website VARCHAR(255),address_state CHAR(2),address_zip_code VARCHAR(8),address_street VARCHAR(255),address_number VARCHAR(30),address_complement VARCHAR(255),address_neighborhood VARCHAR(255),address_city VARCHAR(255))`);
  await pool.query('INSERT INTO company_settings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[randomUUID(),'11222333000181','Empresa A','Empresa A','Empresa A Ltda','123','4751201','Micro','0000000000','principal@example.test','https://loja.example.test','PE','56300000','Rua Loja','1','','Centro','Petrolina']);
  const migration = readFileSync(path.join(__dirname,'../migrations/020_company_fiscal_profiles.sql'),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
  for(let round=0;round<2;round++) for(const sql of migration) await pool.query(sql);
  const profile = {cnpj:'11444777000161',name:'Empresa B',legalName:'',stateRegistration:'',stateRegistrationExempt:true,municipalRegistration:'IM-123',suframaRegistration:'SUF-123',cnae:'4751201',cnaeActivities:[{code:'4751201',description:'Comércio especializado',primary:true},{code:'4789001',description:'Comércio de outros produtos',primary:false}],companySize:'Micro',mainActivity:'Comércio',segments:['comercio','ecommerce'],annualRevenueBand:'Maior que R$ 360.000,00',employeesBand:'Até 5 funcionários',contactPerson:'Contato fictício',phone:'0000000000',mobilePhone:'00000000000',email:'empresa@example.test',billingEmail:'cobranca@example.test',website:'https://example.test',substituteStateRegistrations:[{uf:'SP',registration:'123456789'}],uf:'PE',municipalityCode:'2611101',address:{zipCode:'56300-000',street:'Rua Empresa B',number:'12',complement:'Sala 1',neighborhood:'Centro',city:'Petrolina'},regime:'lucro_real',crt:'3',effectiveFrom:'2026-01-01',notes:'',version:0};
  app=Fastify();
  await app.register(require('@fastify/multipart'));
  let vaultInstalled = false;
  const certificateVault = {
    MAX_PFX_BYTES: 5 * 1024 * 1024,
    async installCertificate(_id,pfx,password,expectedCnpj) { assert.equal(password,'fixture-secret'); assert.equal(expectedCnpj,'11444777000161'); assert.equal(pfx.toString(),'PFX-FIXTURE'); vaultInstalled=true; return {validUntil:'2027-03-02',storageRef:'fixture.vault',fingerprintSha256:'AA:BB',subjectName:'CN=EMPRESA B:11444777000161',issuerName:'CN=AC TESTE',serialNumber:'123'}; },
    async exportCertificate(_id,password) { assert.equal(password,'fixture-secret'); assert(vaultInstalled); return Buffer.from('PFX-FIXTURE'); },
    async deleteCertificate(_id,password) { assert.equal(password,'fixture-secret'); vaultInstalled=false; },
    async testSefaz(_id,environment) { assert(vaultInstalled); return {environment,endpoint:'https://sefaz.test',cStat:'107',reason:'Servico em Operacao',operational:true,checkedAt:'2026-09-22T12:00:00.000Z'}; },
  };
  registerCompanyFiscalRoutes(app,{pool,enabled:true,certificateVault,getBearerAuthContext:async req=>req.headers.authorization==='Bearer fixture' ? {isAdmin:true,userId:'fixture-admin'} : {},lookup:async cnpj=>normalizeLookup({cnpj,opcao_pelo_simples:true,opcao_pelo_mei:false},cnpj,'fixture')});
  const call=(method,suffix,payload)=>app.inject({method,url:'/admin/fiscal-companies'+suffix,payload,headers:{authorization:'Bearer fixture'}});
  assert.equal((await app.inject('/admin/fiscal-companies')).statusCode,401);
  const primary=await call('PUT','/primary',{...profile,stateRegistrationExempt:false,billingEmail:'principal-cobranca@example.test',segments:['servicos'],substituteStateRegistrations:[]});assert.equal(primary.statusCode,200,primary.body);
  const second=await call('POST','',profile);assert.equal(second.statusCode,201,second.body);
  const company=second.json();assert.equal(company.effectiveFrom,'2026-01-01');
  assert.equal(company.municipalRegistration,'IM-123');
  assert.equal(primary.json().municipalRegistration,'IM-123');
  assert.equal(company.suframaRegistration,'SUF-123');
  assert.equal(company.stateRegistrationExempt,true);
  assert.equal(company.cnaeActivities[1].description,'Comércio de outros produtos');
  assert.deepEqual(company.substituteStateRegistrations,[{uf:'SP',registration:'123456789'}]);
  assert.deepEqual(company.segments,['comercio','ecommerce']);
  assert.equal(primary.json().email,'principal@example.test');
  assert.equal(company.address.zipCode,'56300000');
  assert.equal(company.address.street,'Rua Empresa B');
  assert.equal(primary.json().address.street,'Rua Loja');
  assert.equal((await call('POST','',profile)).statusCode,409);
  const refreshed=await call('POST',`/${company.id}/refresh`,{version:1});assert.equal(refreshed.statusCode,200,refreshed.body);
  assert.equal(refreshed.json().regime,'lucro_real');assert.equal(refreshed.json().crt,'3');
  const list=(await call('GET','')).json().companies;
  assert.equal(list.length,2);assert.equal(list.find(c=>c.primary).lookup,null);
  assert.equal(list.find(c=>c.primary).municipalRegistration,'IM-123');
  assert.equal(list.find(c=>c.primary).billingEmail,'principal-cobranca@example.test');
  assert.deepEqual(list.find(c=>c.primary).segments,['servicos']);
  assert.equal(list.find(c=>c.id===company.id).billingEmail,'cobranca@example.test');
  assert.equal(list.find(c=>c.id===company.id).cnaeActivities.length,2);
  assert.equal(list.find(c=>c.id===company.id).lookup.simples,true);
  const certificate = await call('PUT',`/${company.id}/certificate`,{validUntil:'2027-03-02',alertDays:365,certificateType:'A1_SERVER'});
  assert.equal(certificate.statusCode,200,certificate.body);
  assert.equal(certificate.json().validUntil,'2027-03-02');
  assert.equal((await call('GET',`/${company.id}/certificate`)).json().alertDays,365);
  const alerts = await app.inject({method:'GET',url:'/admin/fiscal-certificates/alerts',headers:{authorization:'Bearer fixture'}});
  assert.equal(alerts.statusCode,200,alerts.body);
  assert.equal(alerts.json().alerts.length,1);
  const boundary='----mdv-certificate-fixture';
  const multipart=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="password"\r\n\r\nfixture-secret\r\n--${boundary}\r\nContent-Disposition: form-data; name="alertDays"\r\n\r\n45\r\n--${boundary}\r\nContent-Disposition: form-data; name="certificate"; filename="cert.pfx"\r\nContent-Type: application/x-pkcs12\r\n\r\nPFX-FIXTURE\r\n--${boundary}--\r\n`);
  const uploaded=await app.inject({method:'POST',url:`/admin/fiscal-companies/${company.id}/certificate/upload`,headers:{authorization:'Bearer fixture','content-type':`multipart/form-data; boundary=${boundary}`},payload:multipart});
  assert.equal(uploaded.statusCode,200,uploaded.body); assert.equal(uploaded.json().installed,true); assert.equal(uploaded.json().alertDays,45);
  const sefaz=await call('POST',`/${company.id}/certificate/sefaz-status`,{environment:'homologation'}); assert.equal(sefaz.statusCode,200,sefaz.body); assert.equal(sefaz.json().cStat,'107');
  const exported=await call('POST',`/${company.id}/certificate/export`,{password:'fixture-secret'}); assert.equal(exported.statusCode,200,exported.body); assert.equal(exported.rawPayload.toString(),'PFX-FIXTURE');
  const deleted=await call('POST',`/${company.id}/certificate/delete`,{password:'fixture-secret',confirmation:'11.444.777/0001-61'}); assert.equal(deleted.statusCode,200,deleted.body); assert.equal(vaultInstalled,false);
  assert.equal((await call('GET',`/${company.id}/certificate`)).json().installed,false);
  const edits=await Promise.all(['edição A','edição B'].map(notes=>call('PUT',`/${company.id}`,{...refreshed.json(),notes})));
  assert.deepEqual(edits.map(r=>r.statusCode).sort(),[200,409]);
  const [before]=await pool.query('SELECT * FROM company_fiscal_profiles WHERE id=?',[company.id]);
  await pool.query("CREATE TRIGGER fiscal_test_reject_event BEFORE INSERT ON company_fiscal_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture audit failure'");
  const rejected=await call('PUT',`/${company.id}`,{...company,version:before[0].version,notes:'não persistir'});
  assert.equal(rejected.statusCode,500);
  const [after]=await pool.query('SELECT * FROM company_fiscal_profiles WHERE id=?',[company.id]);
  assert.equal(after[0].version,before[0].version);assert.equal(after[0].notes,before[0].notes);
  const [events]=await pool.query('SELECT COUNT(*) AS count FROM company_fiscal_events');assert.equal(events[0].count,8);
  const [settings]=await pool.query('SELECT name FROM company_settings');assert.equal(settings[0].name,'Empresa A');
  console.log('MySQL real: duas aplicações da migration, duas empresas, consulta, concorrência e rollback aprovados.');
  if (process.argv.includes('--browser')) {
    await pool.query('DROP TRIGGER fiscal_test_reject_event');
    await require('./company-fiscal-browser-integration.cjs')(pool);
  }
});
