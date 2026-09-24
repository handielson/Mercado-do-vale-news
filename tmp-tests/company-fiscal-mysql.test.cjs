// Creates only a disposable local Docker MySQL. Never reads application .env.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const Fastify = require('fastify');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const { normalizeLookup } = require('../services/companyFiscalCore.cjs');
const docker = (...args) => execFileSync('docker', ['--context','desktop-linux',...args], { encoding:'utf8', timeout:args[0]==='run'?180000:15000, windowsHide:true, stdio:['ignore','pipe','pipe'] }).trim();
const dockerWithInput = (input, ...args) => execFileSync('docker', ['--context','desktop-linux',...args], { input, encoding:'utf8', timeout:60000, windowsHide:true, stdio:['pipe','pipe','pipe'] });

const normalizeBackupRows = rows => rows.map(row => Object.fromEntries(
  Object.entries(row).map(([key,value]) => [key, Buffer.isBuffer(value) ? value.toString('hex') : value instanceof Date ? value.toISOString() : value])
));

async function snapshotFiscalDatabase(pool, database) {
  const tables = ['company_settings','company_fiscal_profiles','company_fiscal_events','company_certificate_settings','company_fiscal_tax_validations','company_accountant_access','company_fiscal_documents','company_fiscal_sale_reconciliations','company_fiscal_document_reviews','company_fiscal_cancellation_monitor','company_fiscal_document_xmls'];
  const snapshot = {};
  for (const table of tables) {
    const [rows] = await pool.query(`SELECT * FROM \`${database}\`.\`${table}\` ORDER BY 1`);
    snapshot[table] = normalizeBackupRows(rows);
  }
  return snapshot;
}

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
  const migrations = ['020_company_fiscal_profiles.sql','021_company_fiscal_tax_validation.sql','022_accountant_portal.sql','024_fiscal_document_review.sql','025_fiscal_cancellation_monitor.sql','027_fiscal_document_xml_archive.sql'].flatMap(file => readFileSync(path.join(__dirname,'../migrations',file),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean));
  for(let round=0;round<2;round++) for(const sql of migrations) await pool.query(sql);
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
  registerAccountantPortalRoutes(app,{ pool,enabled:true,getBearerAuthContext:async req=>req.headers.authorization==='Bearer fixture' ? {isAdmin:true,customerId:'fixture-admin',userId:'fixture-admin'} : {} });
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
  const taxDraft = await call('GET',`/${company.id}/tax-validation`);
  assert.equal(taxDraft.statusCode,200,taxDraft.body);
  assert.equal(taxDraft.json().status,'draft');
  assert.equal(taxDraft.json().rules.length,10);
  const savedTaxDraft = await call('PUT',`/${company.id}/tax-validation`,{...taxDraft.json(),reviewerName:'Contador de teste',notes:'Rascunho de integração'});
  assert.equal(savedTaxDraft.statusCode,200,savedTaxDraft.body);
  assert.equal(savedTaxDraft.json().version,1);
  assert.equal(savedTaxDraft.json().reviewerName,'Contador de teste');
  const staleTaxDraft = await call('PUT',`/${company.id}/tax-validation`,{...taxDraft.json(),notes:'Versão antiga'});
  assert.equal(staleTaxDraft.statusCode,409,staleTaxDraft.body);
  const operationReview = await call('PUT',`/${company.id}/tax-validation`,{...savedTaxDraft.json(),reviewRuleId:'OP01'});
  assert.equal(operationReview.statusCode,200,operationReview.body);
  assert.equal(operationReview.json().rules[0].review.reviewerName,'Contador de teste');
  assert.equal(operationReview.json().rules[0].review.outdated,false);
  assert.ok(operationReview.json().rules[0].review.reviewedAt);
  const accountantReview = await app.inject({method:'PUT',url:`/accountant/companies/${company.id}/tax-validation`,headers:{authorization:'Bearer fixture'},payload:{...operationReview.json(),reviewRuleId:'OP02'}});
  assert.equal(accountantReview.statusCode,200,accountantReview.body);
  const persistedReview = await call('GET',`/${company.id}/tax-validation`);
  assert.deepEqual(persistedReview.json().rules[0].review,operationReview.json().rules[0].review);
  assert.equal(persistedReview.json().rules[1].review.outdated,false);
  const changedRules = persistedReview.json().rules;
  changedRules[0].cfop = '5103';
  const changedReview = await call('PUT',`/${company.id}/tax-validation`,{...persistedReview.json(),rules:changedRules});
  assert.equal(changedReview.statusCode,200,changedReview.body);
  assert.equal(changedReview.json().rules[0].review.outdated,true);
  assert.equal(changedReview.json().rules[1].review.outdated,false);
  const reviewDocumentId = randomUUID();
  await pool.query('INSERT INTO company_fiscal_documents (id,profile_id,channel,external_sale_id,model,status,document_number,issued_at,total_cents,source,source_reference) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [reviewDocumentId,company.id,'shopee','synthetic-order','55','authorized','TESTE-1','2026-09-23 12:00:00',5791,'test','test-review-1']);
  const reviewUrl=`/accountant/companies/${company.id}/fiscal-documents/${reviewDocumentId}/review`;
  const reviewGet=await app.inject({method:'GET',url:reviewUrl,headers:{authorization:'Bearer fixture'}});
  assert.equal(reviewGet.statusCode,200,reviewGet.body);
  assert.equal(reviewGet.json().review.version,0);
  const reviewSaved=await app.inject({method:'POST',url:reviewUrl,headers:{authorization:'Bearer fixture'},payload:{reviewState:'draft',fiscalAction:'pending',valueTreatment:'Em análise.',version:0}});
  assert.equal(reviewSaved.statusCode,200,reviewSaved.body);
  assert.equal(reviewSaved.json().review.version,1);
  assert.equal((await pool.query('SELECT status,total_cents FROM company_fiscal_documents WHERE id=?',[reviewDocumentId]))[0][0].status,'authorized');
  assert.equal((await pool.query('SELECT review_state FROM company_fiscal_document_reviews WHERE document_id=?',[reviewDocumentId]))[0][0].review_state,'draft');
  await pool.query('INSERT INTO company_fiscal_cancellation_monitor (document_id,profile_id,state,marketplace_status,reason) VALUES (?,?,?,?,?)',
    [reviewDocumentId,company.id,'open_alert','READY_TO_SHIP','open_order_with_authorized_nfe']);
  const [monitorRows]=await pool.query('SELECT profile_id,state,marketplace_status FROM company_fiscal_cancellation_monitor WHERE document_id=?',[reviewDocumentId]);
  assert.deepEqual({profileId:monitorRows[0].profile_id,state:monitorRows[0].state,status:monitorRows[0].marketplace_status},
    {profileId:company.id,state:'open_alert',status:'READY_TO_SHIP'});
  await assert.rejects(pool.query('INSERT INTO company_fiscal_cancellation_monitor (document_id,profile_id) VALUES (?,?)',
    [reviewDocumentId,company.id]),{code:'ER_DUP_ENTRY'});
  await assert.rejects(pool.query('INSERT INTO company_fiscal_cancellation_monitor (document_id,profile_id) VALUES (?,?)',
    [randomUUID(),company.id]),{code:'ER_NO_REFERENCED_ROW_2'});
  assert.equal((await app.inject({method:'POST',url:reviewUrl,headers:{authorization:'Bearer fixture'},payload:{reviewState:'draft',fiscalAction:'pending',version:0}})).statusCode,409);
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
  const [events]=await pool.query('SELECT COUNT(*) AS count FROM company_fiscal_events');assert.equal(events[0].count,13);
  const [settings]=await pool.query('SELECT name FROM company_settings');assert.equal(settings[0].name,'Empresa A');
  await pool.query('DROP TRIGGER fiscal_test_reject_event');

  const originalXml=readFileSync(path.join(__dirname,'fixtures/accountant-nfce.xml'),'utf8');
  const accessKey=originalXml.match(/<chNFe>(\d{44})<\/chNFe>/)[1];
  const [primaryProfiles]=await pool.query("SELECT id FROM company_fiscal_profiles WHERE settings_id IS NOT NULL");
  const archiveId=randomUUID();
  await pool.query('INSERT INTO company_fiscal_documents (id,profile_id,channel,external_sale_id,model,status,access_key,document_number,series,issued_at,total_cents,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[archiveId,primaryProfiles[0].id,'pdv','fixture-sale','65','authorized',accessKey,'1','1','2026-09-24 14:00:00',500,'fixture']);
  const archiveUrl='/accountant/companies/primary/fiscal-documents/'+archiveId;
  const api=(method,url,payload)=>app.inject({method,url,payload,headers:{authorization:'Bearer fixture'}});
  const archived=await api('POST',archiveUrl+'/archive-xml',{xml:originalXml});assert.equal(archived.statusCode,200,archived.body);
  const xmlDownload=await api('GET',archiveUrl+'/file?format=xml');assert.equal(xmlDownload.statusCode,200,xmlDownload.body);assert.equal(Buffer.from(xmlDownload.json().base64,'base64').toString(),originalXml);
  const other=await api('GET','/accountant/companies/'+company.id+'/fiscal-documents/'+archiveId+'/file?format=xml');assert.equal(other.statusCode,404,other.body);
  const changedXml=await api('POST',archiveUrl+'/archive-xml',{xml:originalXml.replace('PRODUTO TESTE','OUTRO PRODUTO')});assert.equal(changedXml.statusCode,409,changedXml.body);

  const sourceSnapshot = await snapshotFiscalDatabase(pool,'mdv_fiscal_test');
  const dump = docker('exec',container,'mysqldump','-uroot',`-p${password}`,'--single-transaction','--skip-lock-tables','--no-tablespaces','mdv_fiscal_test');
  assert.match(dump,/CREATE TABLE `company_fiscal_profiles`/);
  assert.match(dump,/INSERT INTO `company_fiscal_profiles`/);
  assert.match(dump,/CREATE TABLE `company_fiscal_tax_validations`/);
  assert.match(dump,/INSERT INTO `company_fiscal_tax_validations`/);
  assert.match(dump,/CREATE TABLE `company_fiscal_document_reviews`/);
  assert.match(dump,/INSERT INTO `company_fiscal_document_reviews`/);
  assert.match(dump,/CREATE TABLE `company_fiscal_cancellation_monitor`/);
  assert.match(dump,/INSERT INTO `company_fiscal_cancellation_monitor`/);
  const dumpSha256 = createHash('sha256').update(dump).digest('hex');
  assert.match(dumpSha256,/^[a-f0-9]{64}$/);

  docker('exec',container,'mysql','-uroot',`-p${password}`,'-e','CREATE DATABASE mdv_fiscal_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  dockerWithInput(dump,'exec','-i',container,'mysql','-uroot',`-p${password}`,'mdv_fiscal_restore');
  const restoredSnapshot = await snapshotFiscalDatabase(pool,'mdv_fiscal_restore');
  assert.deepEqual(restoredSnapshot,sourceSnapshot,'A restauração deve preservar integralmente cadastros, eventos e metadados fiscais');

  await pool.query('UPDATE company_fiscal_profiles SET notes=? WHERE id=?',['alteração posterior ao backup',company.id]);
  const [restoredRows] = await pool.query('SELECT notes FROM mdv_fiscal_restore.company_fiscal_profiles WHERE id=?',[company.id]);
  assert.notEqual(restoredRows[0].notes,'alteração posterior ao backup','O banco restaurado deve permanecer isolado da origem');

  console.log(`MySQL real: migration, fixtures, concorrência, rollback e restauração integral aprovados (SHA-256 ${dumpSha256.slice(0,12)}…).`);
  if (process.argv.includes('--browser')) {
    await require('./company-fiscal-browser-integration.cjs')(pool);
  }
});
