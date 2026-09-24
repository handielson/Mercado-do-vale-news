// Creates only a disposable local Docker MySQL. Never reads application .env.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const forge = require('node-forge');
const Fastify = require('fastify');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const { normalizeLookup } = require('../services/companyFiscalCore.cjs');
const { configureNfceSequence, reserveNfceForSale } = require('../services/fiscalNfceNumbering.cjs');
const { makeNfceAccessKey } = require('../services/fiscalNfceAccessKey.cjs');
const { prepareReservedNfce } = require('../services/fiscalNfcePersistence.cjs');
const { buildHomologationNfceDraft } = require('../services/fiscalNfceDraft.cjs');
const { prepareHomologationNfceForSale } = require('../services/fiscalNfceSalePreparation.cjs');
const { authorizedDanfeForSale } = require('../services/fiscalNfceDanfeRead.cjs');
const { defaultRules, defaultGeneralDecisions } = require('../services/fiscalTaxValidationCore.cjs');
const { transmitPreparedNfce, reconcileNfceByKey } = require('../services/fiscalNfceTransmission.cjs');
const docker = (...args) => execFileSync('docker', ['--context','desktop-linux',...args], { encoding:'utf8', timeout:args[0]==='run'?180000:15000, windowsHide:true, stdio:['ignore','pipe','pipe'] }).trim();
const dockerWithInput = (input, ...args) => execFileSync('docker', ['--context','desktop-linux',...args], { input, encoding:'utf8', timeout:60000, windowsHide:true, stdio:['pipe','pipe','pipe'] });

const normalizeBackupRows = rows => rows.map(row => Object.fromEntries(
  Object.entries(row).map(([key,value]) => [key, Buffer.isBuffer(value) ? value.toString('hex') : value instanceof Date ? value.toISOString() : value])
));

async function snapshotFiscalDatabase(pool, database) {
  const tables = ['company_settings','company_fiscal_profiles','company_fiscal_events','company_certificate_settings','company_fiscal_tax_validations','company_accountant_access','company_fiscal_documents','company_fiscal_sale_reconciliations','company_fiscal_document_reviews','company_fiscal_cancellation_monitor','company_fiscal_nfce_sequences','company_fiscal_nfce_issuances','company_fiscal_document_xmls'];
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
  const migrations = ['020_company_fiscal_profiles.sql','021_company_fiscal_tax_validation.sql','022_accountant_portal.sql','024_fiscal_document_review.sql','025_fiscal_cancellation_monitor.sql','026_nfce_issuance_foundation.sql','027_fiscal_document_xml_archive.sql'].flatMap(file => readFileSync(path.join(__dirname,'../migrations',file),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean));
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
  const [primaryProfileRows] = await pool.query('SELECT id,settings_id FROM company_fiscal_profiles WHERE settings_id IS NOT NULL LIMIT 1');
  const primaryProfile = primaryProfileRows[0];
  await pool.query('CREATE TABLE sales (id CHAR(36) PRIMARY KEY, company_id CHAR(36) NULL, status VARCHAR(30), payment_status VARCHAR(30))');
  const saleA = randomUUID(), saleB = randomUUID(), saleC = randomUUID();
  for (const saleId of [saleA,saleB,saleC]) await pool.query('INSERT INTO sales VALUES (?,?,?,?)',[saleId,primaryProfile.settings_id,'completed','paid']);
  await pool.query('INSERT INTO company_fiscal_documents (id,profile_id,channel,external_sale_id,model,status,document_number,series,total_cents,source,source_reference) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [randomUUID(),primaryProfile.id,'bling','nfce:fixture','65','authorized','124','1',900,'bling_import','fixture-nfce']);
  await assert.rejects(configureNfceSequence(pool,{profileId:primaryProfile.id,environment:'production',series:1,blingLastNumber:124,actor:'fiscal-test'}),/conferência final/);
  await assert.rejects(configureNfceSequence(pool,{profileId:primaryProfile.id,environment:'production',series:1,blingLastNumber:123,actor:'fiscal-test',cutoverConfirmed:true}),/menor que o histórico/);
  const productionSequence=await configureNfceSequence(pool,{profileId:primaryProfile.id,environment:'production',series:1,blingLastNumber:124,actor:'fiscal-test',cutoverConfirmed:true});
  assert.equal(productionSequence.nextNumber,125);
  const configured=await configureNfceSequence(pool,{profileId:primaryProfile.id,environment:'homologation',series:1,blingLastNumber:0,actor:'fiscal-test'});
  assert.equal(configured.nextNumber,1);
  await assert.rejects(reserveNfceForSale(pool,{profileId:primaryProfile.id,saleId:saleA,environment:'production',series:2}),/ainda não conferida/);
  const reservationA=await reserveNfceForSale(pool,{profileId:primaryProfile.id,saleId:saleA,environment:'homologation',series:1});
  assert.equal(reservationA.document_number,1);
  const [issuerRows] = await pool.query('SELECT cnpj FROM company_fiscal_profiles WHERE id=?',[primaryProfile.id]);
  const accessKey = makeNfceAccessKey({ ufCode:'26', issuedAt:'2026-09-24T14:00:00-03:00', cnpj:issuerRows[0].cnpj,
    series:1, number:reservationA.document_number, numericCode:12345678 }).key;
  const syntheticDraft = { xml:'<NFe>fixture</NFe>', accessKey, environment:'homologation' };
  const persistenceOptions = { readCertificate:async () => ({ pfx:Buffer.from('fixture'), password:'fixture' }),
    sign:async input => ({ accessKey:input.accessKey, xml:`<NFe Id="NFe${input.accessKey}">fixture assinada apenas para persistência MySQL</NFe>` }) };
  assert.equal((await prepareReservedNfce(pool,{issuanceId:reservationA.id,draft:syntheticDraft},persistenceOptions)).existing,false);
  assert.equal((await prepareReservedNfce(pool,{issuanceId:reservationA.id,draft:syntheticDraft},persistenceOptions)).existing,true);
  const [storedNfce] = await pool.query('SELECT status,access_key,signed_xml FROM company_fiscal_nfce_issuances WHERE id=?',[reservationA.id]);
  assert.equal(storedNfce[0].status,'prepared');
  assert.equal(storedNfce[0].access_key,accessKey);
  assert.match(storedNfce[0].signed_xml,/fixture assinada/);
  assert.equal((await reserveNfceForSale(pool,{profileId:primaryProfile.id,saleId:saleA,environment:'homologation',series:1})).id,reservationA.id);
  const concurrent=await Promise.all([saleB,saleC].map(saleId=>reserveNfceForSale(pool,{profileId:primaryProfile.id,saleId,environment:'homologation',series:1})));
  assert.deepEqual(concurrent.map(row=>row.document_number).sort(),[2,3]);
  const reserveB = concurrent.find(row => row.document_number === 2);
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate(); cert.publicKey=keys.publicKey; cert.serialNumber='01';
  cert.validity.notBefore=new Date('2025-01-01T00:00:00Z'); cert.validity.notAfter=new Date('2027-01-01T00:00:00Z');
  cert.setSubject([{name:'commonName',value:`EMPRESA TESTE:${issuerRows[0].cnpj}`}]); cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey,forge.md.sha256.create());
  const pfx=Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'senha-teste',{algorithm:'3des'})).getBytes(),'binary');
  const fiscalDraft=buildHomologationNfceDraft({ issuer:{ufCode:'26',cnpj:issuerRows[0].cnpj,name:'EMPRESA TESTE',stateRegistration:'123456789',
    address:{street:'RUA TESTE',number:'10',district:'CENTRO',municipalityCode:'2611101',city:'PETROLINA',state:'PE',postalCode:'56310150'}},
    series:1,number:reserveB.document_number,issuedAt:'2026-09-24T14:00:00-03:00',numericCode:12345678,nature:'VENDA',
    items:[{sku:'A',description:'PRODUTO',ncm:'85444200',cest:'1200700',gtin:'SEM GTIN',unit:'UND',quantity:1,unitPriceCents:500,
      cfop:'5102',origin:'0',csosn:'400',pisCst:'07',cofinsCst:'07'}],payments:[{method:'01',amountCents:500}]});
  const mtlsOptions={readCertificate:async()=>({pfx,password:'senha-teste'})};
  await prepareReservedNfce(pool,{issuanceId:reserveB.id,draft:fiscalDraft},mtlsOptions);
  const timeoutState=await transmitPreparedNfce(pool,reserveB.id,{...mtlsOptions,request:async()=>{throw new Error('timeout simulado');}});
  assert.equal(timeoutState.state,'uncertain');
  await assert.rejects(transmitPreparedNfce(pool,reserveB.id,mtlsOptions),/não reenviar/);
  const protocol=`<protNFe xmlns="http://www.portalfiscal.inf.br/nfe"><infProt><tpAmb>2</tpAmb><chNFe>${fiscalDraft.accessKey}</chNFe><dhRecbto>2026-09-24T14:00:03-03:00</dhRecbto><nProt>126260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protNFe>`;
  const reconciled=await reconcileNfceByKey(pool,reserveB.id,{...mtlsOptions,request:async()=>({statusCode:200,
    body:`<retConsSitNFe><tpAmb>2</tpAmb><cStat>100</cStat><xMotivo>Autorizado</xMotivo>${protocol}</retConsSitNFe>`})});
  assert.equal(reconciled.state,'authorized');
  const [authorizedRows]=await pool.query('SELECT status,authorized_xml_sha256,authorization_protocol FROM company_fiscal_nfce_issuances WHERE id=?',[reserveB.id]);
  assert.equal(authorizedRows[0].status,'authorized');
  assert.match(authorizedRows[0].authorized_xml_sha256,/^[a-f0-9]{64}$/);
  assert.equal(authorizedRows[0].authorization_protocol,'126260000000001');
  const danfeFromSale=await authorizedDanfeForSale(pool,{profileId:primaryProfile.id,saleId:saleB,cnpj:issuerRows[0].cnpj});
  assert.equal(danfeFromSale.authorizationProtocol,'126260000000001');
  assert.equal(danfeFromSale.accessKey,fiscalDraft.accessKey);
  await assert.rejects(configureNfceSequence(pool,{profileId:primaryProfile.id,environment:'homologation',series:1,blingLastNumber:1,actor:'fiscal-test'}),/não pode retroceder/);
  await assert.rejects(reserveNfceForSale(pool,{profileId:company.id,saleId:saleA,environment:'homologation',series:1}),/empresas adicionais/);
  assert.equal((await pool.query('SELECT next_number FROM company_fiscal_nfce_sequences WHERE profile_id=? AND environment=? AND series=?',[primaryProfile.id,'homologation',1]))[0][0].next_number,4);
  await pool.query("ALTER TABLE sales ADD COLUMN finalization_status VARCHAR(30) DEFAULT 'success', ADD COLUMN total INT DEFAULT 0, ADD COLUMN discount INT DEFAULT 0, ADD COLUMN discount_total INT DEFAULT 0, ADD COLUMN promotional_discount INT DEFAULT 0, ADD COLUMN delivery_cost_store INT DEFAULT 0, ADD COLUMN delivery_cost_customer INT DEFAULT 0, ADD COLUMN final_adjustment_discount INT DEFAULT 0, ADD COLUMN delivery_type VARCHAR(30) NULL, ADD COLUMN payment_methods JSON NULL");
  await pool.query('CREATE TABLE products (id CHAR(36) PRIMARY KEY,ncm VARCHAR(8),cest VARCHAR(7),origin VARCHAR(1),ean VARCHAR(14),alternative_eans JSON,is_virtual TINYINT DEFAULT 0)');
  await pool.query('CREATE TABLE sale_items (id CHAR(36) PRIMARY KEY,sale_id CHAR(36),product_id CHAR(36),product_sku VARCHAR(60),product_name VARCHAR(120),quantity INT,unit_price INT,total INT,discount INT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const fiscalSaleId=randomUUID(),fiscalProductId=randomUUID();
  await pool.query('INSERT INTO sales (id,company_id,status,payment_status,total,payment_methods) VALUES (?,?,?,?,?,?)',[fiscalSaleId,primaryProfile.settings_id,'completed','paid',500,JSON.stringify([{method:'money',amount:500}])]);
  await pool.query('INSERT INTO products (id,ncm,cest,origin,alternative_eans) VALUES (?,?,?,?,?)',[fiscalProductId,'85444200','1200700','0','[]']);
  await pool.query('INSERT INTO sale_items (id,sale_id,product_id,product_sku,product_name,quantity,unit_price,total,discount) VALUES (?,?,?,?,?,?,?,?,?)',[randomUUID(),fiscalSaleId,fiscalProductId,'SKU','PRODUTO',1,500,500,0]);
  await pool.query('CREATE TABLE customers (id VARCHAR(80) PRIMARY KEY,user_id VARCHAR(80),customer_type VARCHAR(30))');
  await pool.query('INSERT INTO customers VALUES (?,?,?)',['fixture-accountant','accountant-user','ACCOUNTANT']);
  await pool.query('INSERT INTO company_accountant_access (id,profile_id,customer_id,can_edit_tax_validation,can_view_revenue,is_active,created_by) VALUES (?,?,?,?,?,?,?)',
    [randomUUID(),primaryProfile.id,'fixture-accountant',1,1,1,'fixture']);
  const fiscalRules=defaultRules();
  Object.assign(fiscalRules[0],{source:'accountant',model:'65',review:{actor:'accountant-user',reviewerRegistration:'CRC-TESTE',reviewedAt:'2026-09-24T17:00:00.000Z',outdated:false},nfce:{unit:'UND',csosn:'400',pisCst:'07',cofinsCst:'07',icmsRate:'0',pisRate:'0',cofinsRate:'0',cestApplicability:'required',gtinDecision:'sem_gtin'}});
  await pool.query('INSERT INTO company_fiscal_tax_validations (profile_id,status,reviewer_registration,rules_json,bling_reference_json,updated_by) VALUES (?,?,?,?,?,?)',
    [primaryProfile.id,'approved','CRC-TESTE',JSON.stringify({rules:fiscalRules,generalDecisions:{...defaultGeneralDecisions(),productExceptions:'none'}}),'{}','fixture']);
  const preparedFromSale=await prepareHomologationNfceForSale(pool,{profileId:primaryProfile.id,settingsId:primaryProfile.settings_id,saleId:fiscalSaleId,series:1,
    company:{cnpj:issuerRows[0].cnpj,legalName:'EMPRESA TESTE',stateRegistration:'123456789',municipalityCode:'2611101',uf:'PE',address:{street:'RUA TESTE',number:'10',neighborhood:'CENTRO',city:'PETROLINA',zipCode:'56310150'}}},
    {now:new Date('2026-09-24T17:00:00Z'),randomInt:()=>12345678,persistenceOptions:mtlsOptions});
  assert.equal(preparedFromSale.status,'prepared');
  const [preparedSaleRows]=await pool.query('SELECT sale_id,status,document_number,signed_xml FROM company_fiscal_nfce_issuances WHERE id=?',[preparedFromSale.issuanceId]);
  assert.equal(preparedSaleRows[0].sale_id,fiscalSaleId);
  assert.equal(preparedSaleRows[0].document_number,4);
  assert.match(preparedSaleRows[0].signed_xml,/<vNF>5\.00<\/vNF>/);
  assert.equal((await prepareHomologationNfceForSale(pool,{profileId:primaryProfile.id,settingsId:primaryProfile.settings_id,saleId:fiscalSaleId,series:1,
    company:{cnpj:issuerRows[0].cnpj,legalName:'EMPRESA TESTE',stateRegistration:'123456789',municipalityCode:'2611101',uf:'PE',address:{street:'RUA TESTE',number:'10',neighborhood:'CENTRO',city:'PETROLINA',zipCode:'56310150'}}},
    {now:new Date('2026-09-24T17:01:00Z'),randomInt:()=>87654321,persistenceOptions:mtlsOptions})).issuanceId,preparedFromSale.issuanceId);
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

  // Original XML archive is included in backup/restore, without storing PDF blobs.
  await pool.query('INSERT INTO company_fiscal_document_xmls (document_id,profile_id,authorized_xml,xml_sha256,archived_by) VALUES (?,?,?,?,?)',[randomUUID(),primaryProfile.id,danfeFromSale.authorizedXml,danfeFromSale.authorizedXmlSha256,'fixture']);
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
  assert.match(dump,/CREATE TABLE `company_fiscal_nfce_sequences`/);
  assert.match(dump,/INSERT INTO `company_fiscal_nfce_issuances`/);
  const dumpSha256 = createHash('sha256').update(dump).digest('hex');
  assert.match(dumpSha256,/^[a-f0-9]{64}$/);

  docker('exec',container,'mysql','-uroot',`-p${password}`,'-e','CREATE DATABASE mdv_fiscal_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  dockerWithInput(dump,'exec','-i',container,'mysql','-uroot',`-p${password}`,'mdv_fiscal_restore');
  const restoredSnapshot = await snapshotFiscalDatabase(pool,'mdv_fiscal_restore');
  assert.deepEqual(restoredSnapshot,sourceSnapshot,'A restauração deve preservar integralmente cadastros, eventos e metadados fiscais');
  const restoredPool=mysql.createPool({...config,database:'mdv_fiscal_restore'});
  try { assert.equal((await authorizedDanfeForSale(restoredPool,{profileId:primaryProfile.id,saleId:saleB,cnpj:issuerRows[0].cnpj})).authorizedXmlSha256,danfeFromSale.authorizedXmlSha256); }
  finally { await restoredPool.end(); }

  await pool.query('UPDATE company_fiscal_profiles SET notes=? WHERE id=?',['alteração posterior ao backup',company.id]);
  const [restoredRows] = await pool.query('SELECT notes FROM mdv_fiscal_restore.company_fiscal_profiles WHERE id=?',[company.id]);
  assert.notEqual(restoredRows[0].notes,'alteração posterior ao backup','O banco restaurado deve permanecer isolado da origem');

  console.log(`MySQL real: migration, fixtures, concorrência, rollback e restauração integral aprovados (SHA-256 ${dumpSha256.slice(0,12)}…).`);
  if (process.argv.includes('--browser')) {
    await require('./company-fiscal-browser-integration.cjs')(pool);
  }
});
