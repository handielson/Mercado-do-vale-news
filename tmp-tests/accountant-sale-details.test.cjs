const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { readAccountantSale } = require('../services/accountantSaleDetails.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const { validateArchivedXml, readArchivedXml, renderFiscalPdf } = require('../services/fiscalDocumentArchive.cjs');
const fixtureXml = require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/accountant-nfce.xml'),'utf8');
const { checkDigit } = require('../services/fiscalNfceAccessKey.cjs');
const { authorizedDanfeForSale } = require('../services/fiscalNfceDanfeRead.cjs');
const { createHash } = require('node:crypto');
const { collectBlingFiscalDocuments } = require('../services/blingFiscalImportCore.cjs');

const profile = { id:'11111111-1111-4111-8111-111111111111', public_id:'primary', operational_company_id:'company', cnpj:'11222333000181' };
const saleId = '22222222-2222-4222-8222-222222222222';
function fixture(model = '65') {
  const originalKey = fixtureXml.match(/<chNFe>(\d{44})<\/chNFe>/)[1];
  const base = originalKey.slice(0,20) + model + originalKey.slice(22,43);
  const key = base + checkDigit(base);
  const xml = fixtureXml.replaceAll(originalKey,key).replace('<mod>65</mod>','<mod>'+model+'</mod>').replace(/<cDV>\d<\/cDV>/,'<cDV>'+key[43]+'</cDV>').replace('</emit>', '</emit>' + (model === '55' ? '<dest><CNPJ>99999999000191</CNPJ><xNome>DESTINATARIO TESTE</xNome><enderDest><xLgr>RUA TESTE</xLgr><nro>20</nro><xBairro>CENTRO</xBairro><cMun>2611101</cMun><xMun>PETROLINA</xMun><UF>PE</UF><CEP>56310150</CEP></enderDest><indIEDest>9</indIEDest></dest>' : ''));
  return {key,xml,document:{id:'doc',model,access_key:key,document_number:'1',series:'1',status:'authorized'}};
}

test('PDV expõe itens e pagamentos em centavos sem custos, lucro ou credenciais; módulo fiscal ausente é tolerado', async () => {
  const queries=[];
  const result = await readAccountantSale({ query:async (sql,params) => {
    queries.push(sql);
    if (sql.includes('FROM sales s')) { assert.deepEqual(params,[saleId]); return [[{ total:900,subtotal:1000,discount_total:100,delivery_cost_customer:0,customer_name:'Cliente',profit:500,payment_methods:JSON.stringify([{method:'pix',amount:900,gateway_id:'secret'}]) }]]; }
    if (sql.includes('FROM sale_items')) return [[{product_name:'Produto',product_sku:'SKU',quantity:2,unit_price:500,total:900,unit_cost:200}]];
    if (sql.includes('FROM company_fiscal_documents')) { assert.deepEqual(params,[profile.id,'pdv',saleId]); return [[]]; }
    if (sql.includes('company_fiscal_nfce_issuances')) { assert.match(sql,/environment='production'/); throw Object.assign(new Error('missing'),{code:'ER_NO_SUCH_TABLE'}); }
    throw new Error(sql);
  } },profile,'pdv',saleId);
  assert.equal(result.totalCents,900); assert.equal(result.shippingCents,0); assert.equal(result.items[0].unitPriceCents,500); assert.equal(result.payments[0].amountCents,900); assert.equal(result.receipt,null);
  assert(!/secret|profit|unit_cost|gateway_id/.test(JSON.stringify(result))); assert(queries.every(sql=>sql.startsWith('SELECT')));
});

test('empresa secundária e pedidos de outra empresa não têm detalhes',async()=>{
  await assert.rejects(readAccountantSale({query:()=>{throw new Error('não deve consultar');}},{...profile,public_id:'other'},'pdv',saleId),{statusCode:403});
  await assert.rejects(readAccountantSale({query:async(sql,args)=>{assert.match(sql,/company_id=\?/);assert.deepEqual(args,[saleId,'company']);return [[]];}},profile,'online',saleId),{statusCode:404});
});

test('venda legada em reais mantém os valores de itens e pagamento',async()=>{
  const result=await readAccountantSale({query:async sql=>{
    if(sql.includes('FROM sales s'))return [[{total:'9.50',payment_method:'pix'}]];
    if(sql.includes('FROM sale_items'))return [[{product_name:'P',quantity:1,unit_price:'9.50',total:'9.50'}]];
    return [[]];
  }},profile,'pdv',saleId);
  assert.equal(result.totalCents,950);assert.equal(result.items[0].unitPriceCents,950);assert.equal(result.payments[0].amountCents,950);
});

test('snapshot marketplace preserva desconhecidos em vez de inventar zero',async()=>{
  const result=await readAccountantSale({query:async sql=>sql.includes('mobile_sale_events')?[[{total_cents:1000,details_json:{items:[{name:'P',quantity:1,unit_price_cents:1000,total_cents:1000}],payment:'PIX',profit_cents:700,customer_phone:'secret'},created_at:'2026-09-24'}]]:[[]]},profile,'shopee','ORDER');
  assert.equal(result.discountCents,null);assert.equal(result.shippingCents,null);assert.equal(result.payments[0].amountCents,null);assert(!JSON.stringify(result).includes('secret'));
});

test('XML arquivado confere empresa, modelo, chave, protocolo e produção; bloqueia entidades',()=>{
  const {xml,document}=fixture();
  assert.equal(validateArchivedXml(xml,document,profile.cnpj).hash.length,64);
  for(const invalid of [xml.replace('<tpAmb>1</tpAmb>','<tpAmb>2</tpAmb>'),xml.replace('<cStat>100</cStat>','<cStat>110</cStat>'),'<!DOCTYPE x>'+xml]) assert.throws(()=>validateArchivedXml(invalid,document,profile.cnpj));
  assert.throws(()=>validateArchivedXml(xml,document,'99999999999999'));
  assert.throws(()=>validateArchivedXml(xml,{...document,access_key:'0'.repeat(44)},profile.cnpj));
});

test('importação coleta XML original junto aos metadados e propaga falha no download',async()=>{
  const {xml,key}=fixture('55');let downloads=0;
  const options={listPage:async(type,status)=>type==='nfe'&&status===5?[{id:1,situacao:5}]:[],getDetail:async()=>({id:1,situacao:5,tipo:1,dataEmissao:'2026-09-24',valorNota:5,chaveAcesso:key,numero:1,serie:1}),getXml:async()=>{downloads++;return xml;}};
  const documents=await collectBlingFiscalDocuments(options);
  assert.equal(downloads,1);assert.equal(documents[0].authorizedXml,xml);
  await assert.rejects(collectBlingFiscalDocuments({...options,getXml:async()=>{throw new Error('download indisponível');}}),/download indisponível/);
});

test('arquivo exige mesmo perfil, não depende do Bling e confere hash',async()=>{
  const {xml,document}=fixture();
  let digest=createHash('sha256').update(xml).digest('hex');
  const pool={query:async(sql,args)=>{assert.equal(args[1],profile.id);return [sql.includes('document_xmls')?[{authorized_xml:xml,xml_sha256:digest}]:[document]];}};
  assert.equal((await readArchivedXml(pool,profile,'doc')).xml,xml);
  digest='wrong';await assert.rejects(readArchivedXml(pool,profile,'doc'),/Integridade/);
});

test('gera PDFs reais de NF-e e NFC-e em memória',async()=>{
  for(const model of ['55','65']) {
    const {xml}=fixture(model);
    const pdf=await renderFiscalPdf(xml);
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>1000);
    const cancelled=await renderFiscalPdf(xml,true);assert.equal(cancelled.subarray(0,5).toString(),'%PDF-');
    if(process.env.MDV_TEST_PDF_DIR) require('node:fs').writeFileSync(require('node:path').join(process.env.MDV_TEST_PDF_DIR,`accountant-${model}.pdf`),pdf);
  }
});

test('NFC-e de produção não aceita XML de homologação nem outra venda',async()=>{
  const {xml,key}=fixture();
  const row={id:'issuance',sale_id:saleId,status:'authorized',environment:'production',access_key:key,authorization_protocol:'126260000000001',authorized_xml:xml,authorized_xml_sha256:createHash('sha256').update(xml).digest('hex')};
  const pool={query:async sql=>{assert.match(sql,/environment='production'/);return [[row]];}};
  assert.equal((await authorizedDanfeForSale(pool,{profileId:profile.id,saleId,cnpj:profile.cnpj,environment:'production'})).environment,'production');
  row.environment='homologation';await assert.rejects(authorizedDanfeForSale(pool,{profileId:profile.id,saleId,cnpj:profile.cnpj,environment:'production'}));
});

test('rotas exigem login e permissão de faturamento; contador não grava XML',async t=>{
  const app=Fastify();t.after(()=>app.close());
  let grant=false;
  registerAccountantPortalRoutes(app,{enabled:true,pool:{query:async sql=>{
    if(sql.includes('FROM company_settings'))return [[{id:'company'}]];
    if(sql.includes('FROM company_fiscal_profiles'))return [[profile]];
    if(sql.includes('FROM company_accountant_access')){assert.match(sql,/can_view_revenue=1/);return [grant?[{id:'grant'}]:[]];}
    throw new Error('dados não devem ser lidos');
  }},getBearerAuthContext:async req=>req.headers.authorization?{customerId:'accountant',userId:'accountant',isAdmin:false}:null});
  const paths=[`/accountant/companies/primary/sales/pdv/${saleId}`,`/accountant/companies/primary/sales/pdv/${saleId}/receipt`,'/accountant/companies/primary/fiscal-documents/doc/file'];
  for(const url of paths){assert.equal((await app.inject({url})).statusCode,401);assert.equal((await app.inject({url,headers:{authorization:'Bearer test'}})).statusCode,403);}
  grant=true;
  assert.equal((await app.inject({method:'POST',url:'/accountant/companies/primary/fiscal-documents/doc/archive-xml',headers:{authorization:'Bearer test'},payload:{xml:'test'}})).statusCode,403);
});
