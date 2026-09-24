const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');

const profileId = '11111111-1111-4111-8111-111111111111';
const otherProfileId = '22222222-2222-4222-8222-222222222222';
const issuanceId = '33333333-3333-4333-8333-333333333333';
const path = id => `/admin/fiscal-companies/${id}/nfce/issuances/${issuanceId}`;

async function fixture({ transmitEnabled = true, prepareEnabled = false } = {}) {
  const app = Fastify();
  const events = [];
  const row = { id:issuanceId, profile_id:profileId, sale_id:'44444444-4444-4444-8444-444444444444', environment:'homologation',
    series:1, document_number:1, status:'prepared', access_key:'26'.padEnd(44,'1'), authorization_protocol:null, authorized_at:null,
    authorized_xml_sha256:null, last_error:null, created_at:new Date(), updated_at:new Date() };
  const pool = { async query(sql, params = []) {
    if (sql.startsWith('SELECT * FROM company_fiscal_profiles WHERE id=')) return [[params[0] === profileId ? { id:profileId, settings_id:null, cnpj:'11222333000181', name:'TESTE', uf:'PE' } : null].filter(Boolean)];
    if (sql.includes('FROM company_fiscal_nfce_issuances WHERE id=? AND profile_id=?')) return [[params[0] === row.id && params[1] === row.profile_id ? { ...row } : null].filter(Boolean)];
    if (sql.includes('FROM company_fiscal_nfce_sequences WHERE profile_id=')) return [[{series:1,next_number:2,checked_at:new Date('2026-09-24T12:00:00Z')}]];
    if (sql.includes('FROM company_certificate_settings WHERE profile_id=')) return [[{installed_at:new Date('2026-09-24T12:00:00Z'),valid_until:'2027-03-01'}]];
    if (sql.includes('SELECT status FROM company_fiscal_tax_validations')) return [[{status:'draft'}]];
    if (sql.startsWith('INSERT INTO company_fiscal_events')) { events.push(params); return [{ affectedRows:1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  let sends = 0, consultations = 0, preparations = 0;
  registerCompanyFiscalRoutes(app, { pool, enabled:true, nfceHomologationEnabled:transmitEnabled,nfceHomologationPrepareEnabled:prepareEnabled,
    getBearerAuthContext:async req => req.headers.authorization === 'Bearer admin' ? { isAdmin:true, userId:'admin-test' } : null,
    nfceTransmission:{ async transmitPreparedNfce(_pool, id) { assert.equal(id, issuanceId); sends++; row.status='uncertain'; return { state:'uncertain', accessKey:row.access_key }; },
      async reconcileNfceByKey(_pool, id) { assert.equal(id, issuanceId); consultations++; row.status='authorized'; return { state:'authorized', authorizationProtocol:'126260000000001' }; } },
    cscVault:{ async cscStatus() { return { configured:true,identifier:'1' }; } },
    nfceSalePreparation:{ async prepareHomologationNfceForSale(_pool,args) { assert.equal(args.profileId,profileId);preparations++;return {issuanceId,status:'prepared',existing:false}; } },
  });
  await app.ready();
  return { app, row, events, counts:()=>({ sends, consultations, preparations }) };
}

test('somente administrador e empresa dona veem a tentativa, sem XML privado', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  assert.equal((await f.app.inject({ method:'GET', url:path(profileId) })).statusCode,401);
  assert.equal((await f.app.inject({ method:'GET', url:path(otherProfileId), headers:{ authorization:'Bearer admin' } })).statusCode,404);
  const view = await f.app.inject({ method:'GET', url:path(profileId), headers:{ authorization:'Bearer admin' } });
  assert.equal(view.statusCode,200);
  assert.equal(view.json().status,'prepared');
  assert.equal('signed_xml' in view.json(),false);
  assert.equal('authorized_xml' in view.json(),false);
});

test('painel de homologação exige administrador e expõe somente status sem CSC privado', async t => {
  const f=await fixture({prepareEnabled:true});t.after(()=>f.app.close());
  const url=`/admin/fiscal-companies/${profileId}/nfce/homologation`;
  assert.equal((await f.app.inject(url)).statusCode,401);
  const response=await f.app.inject({url,headers:{authorization:'Bearer admin'}});
  assert.equal(response.statusCode,200,response.body);
  assert.equal(response.json().environment,'homologation');
  assert.equal(response.json().prepareEnabled,true);
  assert.equal(response.json().validationStatus,'draft');
  assert.equal(response.json().sequences[0].nextNumber,2);
  assert.equal('code' in response.json().csc,false);
});

test('transmissão é desligada por padrão configurável; consulta usa a mesma tentativa', async t => {
  const off = await fixture({ transmitEnabled:false }); t.after(() => off.app.close());
  assert.equal((await off.app.inject({ method:'POST', url:`${path(profileId)}/transmit`, headers:{ authorization:'Bearer admin' } })).statusCode,503);
  assert.equal(off.counts().sends,0);
  const f = await fixture(); t.after(() => f.app.close());
  const headers = { authorization:'Bearer admin' };
  assert.equal((await f.app.inject({ method:'POST', url:`${path(profileId)}/transmit` })).statusCode,401);
  assert.equal((await f.app.inject({ method:'POST', url:`${path(otherProfileId)}/transmit`, headers })).statusCode,404);
  const first = await f.app.inject({ method:'POST', url:`${path(profileId)}/transmit`, headers });
  assert.equal(first.statusCode,200); assert.equal(first.json().state,'uncertain');
  assert.equal((await f.app.inject({ method:'POST', url:`${path(profileId)}/transmit`, headers })).statusCode,409);
  const recovered = await f.app.inject({ method:'POST', url:`${path(profileId)}/reconcile`, headers });
  assert.equal(recovered.statusCode,200); assert.equal(recovered.json().state,'authorized');
  assert.equal((await f.app.inject({ method:'POST', url:`${path(profileId)}/reconcile`, headers })).statusCode,409);
  assert.deepEqual(f.counts(),{ sends:1, consultations:1, preparations:0 });
  assert.deepEqual(f.events.map(event => event[2]),['nfce_homologation_transmit','nfce_homologation_reconcile']);
});

test('preparação de homologação exige administrador e chave separada desligada por padrão', async t => {
  const saleId='44444444-4444-4444-8444-444444444444';
  const url=`/admin/fiscal-companies/${profileId}/nfce/sales/${saleId}/prepare-homologation`;
  const off=await fixture();t.after(()=>off.app.close());
  assert.equal((await off.app.inject({method:'POST',url,payload:{series:1}})).statusCode,401);
  assert.equal((await off.app.inject({method:'POST',url,headers:{authorization:'Bearer admin'},payload:{series:1}})).statusCode,503);
  assert.equal(off.counts().preparations,0);
  const on=await fixture({prepareEnabled:true});t.after(()=>on.app.close());
  const prepared=await on.app.inject({method:'POST',url,headers:{authorization:'Bearer admin'},payload:{series:1}});
  assert.equal(prepared.statusCode,200,prepared.body);
  assert.equal(on.counts().preparations,1);
  assert.deepEqual(on.events.map(event=>event[2]),['nfce_homologation_prepare']);
});
