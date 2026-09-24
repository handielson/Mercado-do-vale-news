const test=require('node:test');
const assert=require('node:assert/strict');
const { createHash }=require('node:crypto');
const Fastify=require('fastify');
const { buildHomologationNfceDraft }=require('../services/fiscalNfceDraft.cjs');
const { authorizedDanfeForSale }=require('../services/fiscalNfceDanfeRead.cjs');
const { registerCompanyFiscalRoutes }=require('../services/companyFiscalServer.cjs');

const profileId='11111111-1111-4111-8111-111111111111';
const saleId='22222222-2222-4222-8222-222222222222';
const cnpj='11222333000181';
const draft=buildHomologationNfceDraft({issuer:{ufCode:'26',cnpj,name:'EMPRESA TESTE',stateRegistration:'123456789',address:{street:'RUA TESTE',number:'10',district:'CENTRO',municipalityCode:'2611101',city:'PETROLINA',state:'PE',postalCode:'56310150'}},series:1,number:1,issuedAt:'2026-09-24T14:00:00-03:00',numericCode:12345678,nature:'VENDA',items:[{sku:'SKU',description:'PRODUTO',ncm:'85444200',cest:'1200700',gtin:'SEM GTIN',unit:'UND',quantity:1,unitPriceCents:500,cfop:'5102',origin:'0',csosn:'400',pisCst:'07',cofinsCst:'07'}],payments:[{method:'01',amountCents:500}]});
const qr=`https://nfce.sefaz.pe.gov.br/nfce/consulta?p=${draft.accessKey}|2|2|1|abcdef`;
const signed=draft.xml.replace('</NFe>',`<infNFeSupl><qrCode>${qr}</qrCode><urlChave>https://nfce.sefaz.pe.gov.br/nfce/consulta</urlChave></infNFeSupl></NFe>`).replace(/^<\?xml[^>]+>/,'');
const protocol='126260000000001';
const xml=`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${signed}<protNFe><infProt><tpAmb>2</tpAmb><chNFe>${draft.accessKey}</chNFe><dhRecbto>2026-09-24T14:00:03-03:00</dhRecbto><nProt>${protocol}</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
const row={id:'33333333-3333-4333-8333-333333333333',sale_id:saleId,status:'authorized',environment:'homologation',access_key:draft.accessKey,authorization_protocol:protocol,authorized_xml:xml,authorized_xml_sha256:createHash('sha256').update(xml).digest('hex')};
const poolFor=record=>({async query(sql,params){assert.match(sql,/profile_id=\? AND sale_id=\?/);assert.deepEqual(params,[profileId,saleId]);return [[record]];}});

test('DANFE lê apenas XML autorizado íntegro da mesma empresa, venda e chave',async()=>{
  const result=await authorizedDanfeForSale(poolFor(row),{profileId,saleId,cnpj});
  assert.equal(result.authorizedXml,xml);
  assert.equal(result.accessKey,draft.accessKey);
  assert.equal(result.environment,'homologation');
  await assert.rejects(authorizedDanfeForSale(poolFor({...row,status:'prepared'}),{profileId,saleId,cnpj}),/Nenhuma NFC-e autorizada/);
  await assert.rejects(authorizedDanfeForSale(poolFor({...row,authorized_xml_sha256:'0'.repeat(64)}),{profileId,saleId,cnpj}),/hash persistido/);
  await assert.rejects(authorizedDanfeForSale(poolFor(row),{profileId,saleId,cnpj:'99999999999999'}),/não corresponde/);
  await assert.rejects(authorizedDanfeForSale(poolFor({...row,authorization_protocol:'000000000000000'}),{profileId,saleId,cnpj}),/não corresponde/);
});

test('rota do DANFE exige administrador, perfil selecionado e não usa XML do cliente',async t=>{
  const app=Fastify();t.after(()=>app.close());
  let reads=0;
  registerCompanyFiscalRoutes(app,{pool:{async query(sql,params){
    if(sql.startsWith('SELECT * FROM company_fiscal_profiles WHERE id='))return [[params[0]===profileId?{id:profileId,settings_id:null,cnpj}:null].filter(Boolean)];
    throw new Error('SQL inesperado');
  }},enabled:true,getBearerAuthContext:async req=>req.headers.authorization==='Bearer admin'?{isAdmin:true,userId:'admin'}:null,
  nfceDanfeRead:{async authorizedDanfeForSale(_pool,args){reads++;assert.equal(args.profileId,profileId);return {saleId:args.saleId,authorizedXml:xml};}}});
  await app.ready();
  const url=`/admin/fiscal-companies/${profileId}/nfce/sales/${saleId}/authorized-danfe`;
  assert.equal((await app.inject({method:'GET',url})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:url.replace(profileId,'99999999-9999-4999-8999-999999999999'),headers:{authorization:'Bearer admin'}})).statusCode,404);
  assert.equal((await app.inject({method:'GET',url,headers:{authorization:'Bearer admin'}})).statusCode,200);
  assert.equal(reads,1);
});
