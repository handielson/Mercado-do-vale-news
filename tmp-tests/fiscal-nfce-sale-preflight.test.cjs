const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { inspectNfceSale } = require('../services/fiscalNfceSalePreflight.cjs');
const { registerCompanyFiscalRoutes } = require('../services/companyFiscalServer.cjs');
const { defaultRules, defaultGeneralDecisions } = require('../services/fiscalTaxValidationCore.cjs');

const profileId = '11111111-1111-4111-8111-111111111111';
const settingsId = '22222222-2222-4222-8222-222222222222';
const saleId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';
function fixture(changes = {}) {
  const sale = { id:saleId, company_id:settingsId, status:'completed', payment_status:'paid', finalization_status:'success',
    total:1000, discount:0, discount_total:0, promotional_discount:0, delivery_cost_store:0,
    delivery_cost_customer:0, final_adjustment_discount:0, delivery_type:null,
    payment_methods:JSON.stringify([{ method:'money', amount:1000 }]), ...changes.sale };
  const items = changes.items || [{ id:'line-1', sale_id:saleId, product_id:productId, product_sku:'SKU', product_name:'Produto', quantity:1, unit_price:1000, total:1000, discount:0 }];
  const product = { id:productId, ncm:'12345678', cest:'1234567', origin:'0', ean:null, alternative_eans:'[]', is_virtual:0, ...changes.product };
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push(sql);
    if (sql.startsWith('SELECT * FROM company_fiscal_profiles')) return [[{ id:profileId, settings_id:settingsId, cnpj:'34719515000168' }]];
    if (sql.startsWith('SELECT * FROM sales')) return [[sale]];
    if (sql.startsWith('SELECT * FROM sale_items')) return [items];
    if (sql.startsWith('SELECT id,ncm')) return [[product]];
    if (sql.startsWith('SELECT * FROM company_fiscal_tax_validations')) return [[changes.validation || { status:'draft' }]];
    if (sql.startsWith('SELECT id,status,environment')) return [[]];
    if (sql.includes('FROM company_accountant_access a JOIN customers c')) return [[changes.accountantGrant === false ? null : { id:'grant-1' }].filter(Boolean)];
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  return { pool, queries };
}

test('prévia lê venda real sem reserva, e indica parâmetros tributários ainda pendentes', async () => {
  const { pool, queries } = fixture();
  const result = await inspectNfceSale(pool, { profileId, settingsId, saleId });
  assert.equal(result.saleTotalCents,1000);
  assert.equal(result.itemTotalCents,1000);
  assert.deepEqual(result.issues.map(row => row.code), ['accountant_validation_pending','item_tax_parameters_pending']);
  assert.equal(result.readyToReserve,false);
  assert.equal(queries.some(sql => /INSERT|UPDATE|DELETE/i.test(sql)),false);
});

test('divergência de itens, pagamento, empresa e venda cancelada bloqueiam tentativa', async () => {
  const { pool } = fixture({ sale:{ status:'cancelled', payment_methods:'[{"method":"pix","amount":900}]' }, items:[{ id:'line-1', product_id:productId, quantity:1, unit_price:1000, total:900, discount:100 }] });
  const result = await inspectNfceSale(pool, { profileId, settingsId, saleId });
  for (const code of ['sale_cancelled_or_refunded','item_amount_unsupported','sale_items_total_mismatch','payment_total_mismatch']) assert.ok(result.issues.some(row => row.code === code), code);
  await assert.rejects(inspectNfceSale(pool, { profileId, settingsId:'outra-loja', saleId }), /não encontrada/);
});

test('dados da venda ficam prontos somente com códigos explícitos aprovados e pagamento suportado', async () => {
  const rules = defaultRules();
  Object.assign(rules[0], { source:'accountant', model:'65', review:{ actor:'accountant-1',reviewerRegistration:'CRC-TESTE',outdated:false }, nfce:{ unit:'UND', csosn:'400', pisCst:'07', cofinsCst:'07', icmsRate:'0',pisRate:'0',cofinsRate:'0',cestApplicability:'required', gtinDecision:'sem_gtin' } });
  const validation = { status:'approved', reviewer_registration:'CRC-TESTE',rules_json:JSON.stringify({ rules, generalDecisions:{ ...defaultGeneralDecisions(), productExceptions:'none' } }) };
  const { pool } = fixture({ validation });
  const result = await inspectNfceSale(pool, { profileId, settingsId, saleId });
  assert.deepEqual(result.issues,[]);
  assert.equal(result.saleDataReady,true);
  assert.equal(result.readyToReserve,false);
  const unsupported = fixture({ validation, sale:{ payment_methods:'[{"method":"pix","amount":1000}]' } });
  assert.ok((await inspectNfceSale(unsupported.pool,{profileId,settingsId,saleId})).issues.some(row=>row.code==='payment_method_mapping_pending'));
  const revoked = fixture({ validation,accountantGrant:false });
  assert.ok((await inspectNfceSale(revoked.pool,{profileId,settingsId,saleId})).issues.some(row=>row.code==='accountant_operation_review_pending'));
});

test('rota exige administrador e não publica dados da venda a cliente', async t => {
  const { pool } = fixture();
  const app = Fastify(); t.after(() => app.close());
  registerCompanyFiscalRoutes(app, { pool, enabled:true, getBearerAuthContext:async req => req.headers.authorization === 'Bearer admin' ? { isAdmin:true, userId:'admin' } : null });
  await app.ready();
  const url = `/admin/fiscal-companies/${profileId}/nfce/sales/${saleId}/preflight`;
  assert.equal((await app.inject({ method:'GET', url })).statusCode,401);
  const response = await app.inject({ method:'GET', url, headers:{ authorization:'Bearer admin' } });
  assert.equal(response.statusCode,200);
  assert.equal(response.json().readyToReserve,false);
});
