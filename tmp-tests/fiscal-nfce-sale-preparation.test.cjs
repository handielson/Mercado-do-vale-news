const test=require('node:test');
const assert=require('node:assert/strict');
const { prepareHomologationNfceForSale, issuerForNfce }=require('../services/fiscalNfceSalePreparation.cjs');

const profileId='11111111-1111-4111-8111-111111111111';
const settingsId='22222222-2222-4222-8222-222222222222';
const saleId='33333333-3333-4333-8333-333333333333';
const issuanceId='44444444-4444-4444-8444-444444444444';
const company={cnpj:'34.719.515/0001-68',legalName:'EMPRESA TESTE',stateRegistration:'084682906',municipalityCode:'2611101',uf:'PE',
  address:{street:'RUA TESTE',number:'10',neighborhood:'CENTRO',city:'PETROLINA',zipCode:'56310150'}};
const plan={items:[{sku:'SKU',description:'PRODUTO',ncm:'85444200',cest:'1200700',gtin:'SEM GTIN',unit:'UND',quantity:1,unitPriceCents:500,cfop:'5102',origin:'0',csosn:'400',pisCst:'07',cofinsCst:'07'}],payments:[{method:'01',amountCents:500}]};

test('prepara apenas a venda lida sob lock, com chave e XML da reserva, sem enviar à SEFAZ',async()=>{
  let signed=false;
  const result=await prepareHomologationNfceForSale({}, {profileId,settingsId,saleId,company,series:1},{
    now:new Date('2026-09-24T17:00:00Z'),randomInt:()=>12345678,
    inspect:async (_db,args)=>{assert.equal(args.lock,true);assert.equal(args.includePlan,true);return {saleDataReady:true,plan};},
    reserve:async (_pool,args,options)=>{assert.equal(args.environment,'homologation');const validation=await options.validate({}, {settings_id:settingsId});return {id:issuanceId,document_number:1,status:'reserved',existing:false,validation};},
    prepare:async (_pool,input)=>{signed=true;assert.equal(input.issuanceId,issuanceId);assert.match(input.draft.xml,/<nNF>1<\/nNF>/);assert.match(input.draft.xml,/<vNF>5\.00<\/vNF>/);return {accessKey:input.draft.accessKey,signedXmlSha256:'a'.repeat(64),existing:false};},
  });
  assert.equal(signed,true);
  assert.equal(result.status,'prepared');
  assert.match(result.accessKey,/^26\d{42}$/);
  assert.equal(issuerForNfce(company).cnpj,'34719515000168');
});

test('pendência fiscal bloqueia antes da numeração; tentativa preparada não ganha nova chave',async()=>{
  let prepareCalls=0;
  const base={profileId,settingsId,saleId,company,series:1};
  await assert.rejects(prepareHomologationNfceForSale({},base,{
    inspect:async()=>({saleDataReady:false,issues:[{code:'accountant_validation_pending'}]}),
    reserve:async (_pool,_args,options)=>{await options.validate({}, {settings_id:settingsId});throw new Error('não deve reservar');},
    prepare:async()=>{prepareCalls++;},
  }),/nenhuma numeração foi reservada/);
  const existing=await prepareHomologationNfceForSale({},base,{
    inspect:async()=>({saleDataReady:true,plan}),
    reserve:async (_pool,_args,options)=>{const validation=await options.validate({}, {settings_id:settingsId});return {id:issuanceId,status:'prepared',existing:true,validation};},
    prepare:async()=>{prepareCalls++;},
  });
  assert.deepEqual(existing,{issuanceId,status:'prepared',existing:true});
  assert.equal(prepareCalls,0);
});
