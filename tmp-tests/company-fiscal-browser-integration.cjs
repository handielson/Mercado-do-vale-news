// Used by the disposable MySQL suite. No production server or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const Fastify = require('fastify');
const { chromium } = require('playwright');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const { pendingPhoneVerification } = require('../services/customerPhoneVerificationServer.cjs');

module.exports = async function verifyBrowser(pool) {
  const source = fs.readFileSync(path.join(__dirname,'../vps_server.cjs'),'utf8');
  const names = ['getBearerToken','base64UrlEncode','base64UrlJson','signVpsAuthToken','verifyVpsAuthToken','normalizeAuthCustomerType','getVpsBearerAuthContext'];
  const ast = ts.createSourceFile('server.cjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const functions = names.map(name => {
    const node = ast.statements.find(n=>ts.isFunctionDeclaration(n) && n.name?.text===name);
    assert(node,`Função canônica ausente: ${name}`); return node.getText(ast);
  }).join('\n');
  const context = vm.createContext({Buffer,crypto,pool,pendingPhoneVerification,VPS_AUTH_SECRET:crypto.randomUUID(),VPS_AUTH_TOKEN_TTL_SECONDS:60,console:{warn(){}}});
  vm.runInContext(functions,context);
  await pool.query('CREATE TABLE customers (id CHAR(36) PRIMARY KEY,user_id CHAR(36),customer_type VARCHAR(30),custom_data JSON)');
  const adminId=crypto.randomUUID(), customerId=crypto.randomUUID();
  await pool.query('INSERT INTO customers VALUES (?,?,?,NULL),(?,?,?,NULL)',[adminId,adminId,'ADMIN',customerId,customerId,'CUSTOMER']);
  const token = context.signVpsAuthToken({userId:adminId,customerId:adminId});
  const customerToken = context.signVpsAuthToken({userId:customerId,customerId});
  const app=Fastify(); let vite,browser;
  try {
    registerCompanyFiscalRoutes(app,{pool,enabled:true,getBearerAuthContext:context.getVpsBearerAuthContext});
    await app.listen({host:'127.0.0.1',port:0});
    const apiUrl=`http://127.0.0.1:${app.server.address().port}`;
    for(const bearer of ['',customerToken,token.slice(0,-4)+'xxxx']) {
      const response=await fetch(apiUrl+'/admin/fiscal-companies',{headers:bearer?{Authorization:`Bearer ${bearer}`}:{}});
      assert.equal(response.status,401);
      const readinessResponse=await fetch(apiUrl+'/admin/fiscal-companies/primary/readiness',{headers:bearer?{Authorization:`Bearer ${bearer}`}:{}});
      assert.equal(readinessResponse.status,401);
    }
    const {createServer}=await import('vite');
    const fixture="import React from 'react';import {createRoot} from 'react-dom/client';import {CompanyFiscalPanel} from '/components/company/CompanyFiscalPanel.tsx';import {CompanyCertificatePanel} from '/components/company/CompanyCertificatePanel.tsx';createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(CompanyFiscalPanel),React.createElement(CompanyCertificatePanel)));";
    vite=await createServer({configFile:false,envDir:false,logLevel:'error',optimizeDeps:{entries:[],include:['react','react-dom/client','react/jsx-dev-runtime']},server:{host:'127.0.0.1',port:0,proxy:{'/vps-proxy':{target:apiUrl,rewrite:p=>new URL(p,'http://127.0.0.1').searchParams.get('path') || '/'}}},plugins:[{
      name:'integrated-fiscal-fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{
        if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/','<html lang="pt-BR"><meta charset="utf-8"><div id="root"></div><script type="module" src="/fiscal-integration.js"></script></html>'));return;}next();
      });},resolveId(id){if(id==='/fiscal-integration.js')return '\0fiscal-integration.js';},load(id){if(id==='\0fiscal-integration.js')return fixture;}
    }]});
    await vite.listen();
    browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
    const page=await browser.newPage();
    page.on('pageerror',error=>console.log('Browser JS:',error.message));
    page.on('response',r=>{if(r.url().includes('/fiscal-companies')) console.log('Fiscal HTTP:',r.status());});
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    await page.addInitScript(({token,id})=>localStorage.setItem('@mdv_vps_auth_session',JSON.stringify({token,user:{id}})),{token,id:adminId});
    const url=`http://127.0.0.1:${vite.httpServer.address().port}`;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
    const regimeField=page.locator('label').filter({hasText:'Regime tributário'}).locator('select');
    const crtField=page.locator('label').filter({hasText:'CRT para emissão'}).locator('select');
    try { await page.getByRole('button',{name:'Adicionar empresa'}).click(); }
    catch(error) { console.log('Tela:',(await page.locator('body').innerText()).slice(0,1200));throw error; }
    await page.getByLabel('Nome da empresa',{exact:true}).fill('Teste consulta pública');
    // Public Banco do Brasil CNPJ, cadastral lookup only; no commercial operations.
    await page.getByLabel('CNPJ da empresa',{exact:true}).fill('00000000000191');
    await page.locator('label').filter({hasText:'UF fiscal'}).locator('select').selectOption('DF');
    await page.getByLabel('Código IBGE do município',{exact:true}).fill('5300108');
    await page.getByLabel('Inscrição municipal',{exact:true}).fill('IM-456');
    await page.getByLabel('Inscrição Suframa',{exact:true}).fill('SUF-456');
    await page.getByLabel('Isento de inscrição estadual',{exact:true}).check();
    await page.getByLabel('Atividade principal (descrição)',{exact:true}).fill('Comércio de teste');
    await page.getByLabel('Comércio',{exact:true}).check();
    await page.getByLabel('E-commerce',{exact:true}).check();
    await page.getByLabel('E-mail de cobrança',{exact:true}).fill('cobranca@example.test');
    await page.getByRole('button',{name:'Adicionar inscrição'}).click();
    await page.getByLabel('UF substituta',{exact:true}).selectOption('SP');
    await page.getByLabel('Inscrição estadual substituta',{exact:true}).fill('123456789');
    await regimeField.selectOption('lucro_real');
    await crtField.selectOption('3');
    await page.getByLabel('CEP fiscal',{exact:true}).fill('70040-010');
    await page.getByLabel('Cidade fiscal',{exact:true}).fill('Brasília');
    await page.getByLabel('Logradouro fiscal',{exact:true}).fill('Rua de teste');
    await page.getByLabel('Número fiscal',{exact:true}).fill('25');
    await page.getByLabel('Bairro fiscal',{exact:true}).fill('Centro');
    await page.getByRole('button',{name:'Salvar cadastro fiscal',exact:true}).click();
    await page.getByText('Cadastro fiscal salvo.',{exact:true}).waitFor();
    const id=await page.getByLabel('Empresa fiscal',{exact:true}).inputValue();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByLabel('Empresa fiscal',{exact:true}).selectOption(id);
    const certificatePanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Certificado digital'})});
    const certificateLoad=page.waitForResponse(response=>decodeURIComponent(response.url()).endsWith(`/${id}/certificate`) && response.request().method()==='GET');
    await certificatePanel.locator('select').first().selectOption(id);
    await certificateLoad;
    await certificatePanel.getByLabel('Validade',{exact:true}).fill('2027-03-02');
    await certificatePanel.getByLabel('Mostrar pop-up com antecedência de').fill('365');
    await certificatePanel.getByRole('button',{name:'Salvar configuração'}).click();
    await certificatePanel.getByText('Configuração do aviso salva.').waitFor();
    const responsePromise=page.waitForResponse(r=>decodeURIComponent(r.url()).endsWith('/refresh'),{timeout:30000});
    await page.getByRole('button',{name:'Atualizar dados tributários',exact:true}).click();
    const response=await responsePromise;
    assert.equal(response.status(),200,'Consulta externa falhou; verificar disponibilidade da fonte');
    await page.getByText('Consulta atualizada. Sua seleção manual foi preservada.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Usar todos os CNAEs consultados'}).click();
    await page.getByRole('button',{name:'Salvar cadastro fiscal',exact:true}).click();
    await page.getByText('Cadastro fiscal salvo.',{exact:true}).waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByLabel('Empresa fiscal',{exact:true}).selectOption(id);
    await certificatePanel.locator('select').first().selectOption(id);
    await page.waitForFunction(() => document.querySelector('section[aria-labelledby="certificate-title"] input[type="date"]')?.value === '2027-03-02');
    assert.equal(await certificatePanel.getByLabel('Validade',{exact:true}).inputValue(),'2027-03-02');
    assert.equal(await regimeField.inputValue(),'lucro_real');
    assert.equal(await crtField.inputValue(),'3');
    assert.equal(await page.getByLabel('Logradouro fiscal',{exact:true}).inputValue(),'Rua de teste');
    assert.equal(await page.getByLabel('Inscrição municipal',{exact:true}).inputValue(),'IM-456');
    assert.equal(await page.getByLabel('Inscrição Suframa',{exact:true}).inputValue(),'SUF-456');
    assert.equal(await page.getByLabel('Isento de inscrição estadual',{exact:true}).isChecked(),true);
    assert.match(await page.getByRole('heading',{name:'CNAEs cadastrados'}).locator('..').innerText(),/Secundário:/);
    assert.equal(await page.getByLabel('E-commerce',{exact:true}).isChecked(),true);
    assert.equal(await page.getByLabel('Inscrição estadual substituta',{exact:true}).inputValue(),'123456789');
    await page.getByRole('heading',{name:'Resultado da consulta do CNPJ'}).waitFor();
    await page.getByRole('button',{name:'Verificar dados para emissão'}).click();
    await page.getByRole('heading',{name:'Pré-validação cadastral'}).waitFor();
    assert.match(await page.getByRole('status').last().innerText(),/Isenção de IE exige confirmação cadastral/);
    assert.match(await page.getByRole('status').last().innerText(),/Município confirmado no IBGE: Brasília\/DF/);
    await page.getByLabel('Empresa fiscal',{exact:true}).selectOption('primary');
    assert.equal(await page.getByRole('heading',{name:'Resultado da consulta do CNPJ'}).count(),0);
    const [rows]=await pool.query('SELECT regime,crt,municipal_registration,suframa_registration,business_segments,billing_email,substitute_state_registrations,state_registration_exempt,cnae_activities,address_zip_code,address_street,lookup_json FROM company_fiscal_profiles WHERE id=?',[id]);
    assert.equal(rows[0].regime,'lucro_real');assert.equal(rows[0].crt,'3');
    assert.equal(rows[0].municipal_registration,'IM-456');
    assert.equal(rows[0].suframa_registration,'SUF-456');
    assert.equal(rows[0].business_segments,'comercio,ecommerce');
    assert.equal(rows[0].billing_email,'cobranca@example.test');
    assert.equal(rows[0].state_registration_exempt,1);
    const savedActivities=typeof rows[0].cnae_activities==='string'?JSON.parse(rows[0].cnae_activities):rows[0].cnae_activities;
    assert(savedActivities.some(item=>item.primary && item.description));
    assert(savedActivities.some(item=>!item.primary && item.description));
    assert.deepEqual(typeof rows[0].substitute_state_registrations==='string'?JSON.parse(rows[0].substitute_state_registrations):rows[0].substitute_state_registrations,[{uf:'SP',registration:'123456789'}]);
    assert.equal(rows[0].address_zip_code,'70040010');assert.equal(rows[0].address_street,'Rua de teste');
    const lookup=typeof rows[0].lookup_json==='string'?JSON.parse(rows[0].lookup_json):rows[0].lookup_json;
    assert.equal(lookup.cnpj,'00000000000191');
    console.log('Navegador → HTTP → autenticação bearer canônica → MySQL: aprovado; fonte externa: '+lookup.source);
  } finally {
    try {if(browser)await browser.close();}finally{try{if(vite)await vite.close();}finally{await app.close();}}
  }
};
