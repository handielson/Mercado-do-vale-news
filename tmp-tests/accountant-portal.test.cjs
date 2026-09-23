const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRevenueReport, normalizeOperationalSale, reconcileSale, validPeriod } = require('../services/accountantPortalCore.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const { majorToCents, normalizeBlingFiscalDocument, collectBlingFiscalDocuments, fiscalDocumentTotals } = require('../services/blingFiscalImportCore.cjs');

test('normaliza NF-e e NFC-e do Bling em centavos sem depender do cache do navegador', () => {
  assert.equal(majorToCents('123.45'), 12345);
  const nfe = normalizeBlingFiscalDocument({ id:321, tipo:1, situacao:5, numero:'99', serie:'1', dataEmissao:'2026-09-10 12:30:00', valorNota:123.45, chaveAcesso:'1'.repeat(44) }, 'nfe');
  assert.deepEqual(nfe, { model:'55', channel:'bling', externalSaleId:'nfe:321', status:'authorized', accessKey:'1'.repeat(44), documentNumber:'99', series:'1', issuedAt:'2026-09-10 12:30:00', totalCents:12345, source:'bling_import', sourceReference:'321' });
  const cancelled = normalizeBlingFiscalDocument({ id:322, tipo:1, situacao:2, dataEmissao:'2026-09-10', valorNota:10 }, 'nfce');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.totalCents, 1000);
  assert.equal(normalizeBlingFiscalDocument({ id:323, tipo:0, situacao:5, dataEmissao:'2026-09-10', valorNota:10 }, 'nfe'), null);
  assert.equal(normalizeBlingFiscalDocument({ id:324, tipo:1, situacao:5, dataEmissao:'2026-09-10' }, 'nfe'), null);
  assert.equal(normalizeBlingFiscalDocument({ id:1, dataEmissao:'inválida' }, 'nfce'), null);
});

test('coleta autorizadas e canceladas dos dois modelos com detalhes e sem perder páginas', async () => {
  const calls = [];
  const docs = await collectBlingFiscalDocuments({
    listPage: async (type, status, page) => {
      calls.push(`${type}:${status}:${page}`);
      return page === 1 ? [{ id: `${type}-${status}`, situacao: status }] : [];
    },
    getDetail: async (type, id) => ({ id, tipo:1, situacao:Number(id.split('-')[1]), dataEmissao:'2026-09-10 12:00:00', valorNota:12.34 }),
  });
  assert.deepEqual(calls, ['nfe:5:1','nfe:2:1','nfce:5:1','nfce:2:1']);
  assert.deepEqual(docs.map(doc => `${doc.model}:${doc.status}:${doc.totalCents}`), [
    '55:authorized:1234','55:cancelled:1234','65:authorized:1234','65:cancelled:1234',
  ]);
});

test('aborta a importação inteira se detalhe divergir ou o período superar o limite', async () => {
  const listPage = async () => [{ id: 1, situacao: 5 }];
  await assert.rejects(collectBlingFiscalDocuments({ listPage, getDetail: async () => ({ id: 1, tipo:1, situacao:2, dataEmissao:'2026-09-10', valorNota:10 }) }), /divergente/);
  await assert.rejects(collectBlingFiscalDocuments({ listPage, getDetail: async () => ({}), maxDocuments:0 }), /Divida em períodos menores/);
  await assert.rejects(collectBlingFiscalDocuments({ listPage, getDetail: async () => ({ id:1, tipo:1, situacao:5, dataEmissao:'2026-09-10' }) }), /incompleto/);
});

test('falha na coleta não inicia gravação fiscal no banco', async () => {
  const routes = new Map();
  const app = { post: (path, options, handler) => routes.set(path, { preHandler: options.preHandler, handler }) };
  for (const method of ['get', 'put', 'delete']) app[method] = () => {};
  let openedTransaction = false;
  const pool = {
    query: async sql => {
      if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', name:'Empresa', cnpj:'123' }]];
      if (sql.includes('FROM company_fiscal_profiles')) return [[{ id:'profile-1', settings_id:'settings-1', name:'Empresa' }]];
      throw new Error(`SQL inesperado: ${sql}`);
    },
    getConnection: async () => { openedTransaction = true; throw new Error('A transação não deveria começar.'); },
  };
  registerAccountantPortalRoutes(app, {
    pool, enabled:true,
    getBearerAuthContext: async () => ({ customerId:'admin', userId:'admin', isAdmin:true }),
    importBlingDocuments: async () => { throw new Error('Detalhe fiscal incompleto'); },
  });
  const route = routes.get('/admin/fiscal-companies/:id/documents/import-bling');
  const req = { params:{ id:'primary' }, body:{ from:'2026-09-01', to:'2026-09-02' } };
  const reply = { sent:false, header(){}, code(){ return this; }, send(value){ this.sent=true; return value; } };
  await route.preHandler(req, reply);
  await assert.rejects(route.handler(req), /Detalhe fiscal incompleto/);
  assert.equal(openedTransaction, false);
});

test('totaliza documentos autorizados e cancelados separadamente', () => {
  assert.deepEqual(fiscalDocumentTotals([{ status:'authorized', total_cents:1000 }, { status:'authorized', totalCents:250 }, { status:'cancelled', total_cents:900 }]), { authorizedDocumentCents:1250, authorizedDocumentCount:2, cancelledDocumentCents:900, cancelledDocumentCount:1 });
});

test('normaliza status operacional sem transformar desconhecido em faturamento', () => {
  assert.equal(normalizeOperationalSale({ channel:'pdv', external_sale_id:'1', status:'completed', total_cents:1234, occurred_at:'2026-09-01T12:00:00Z' }).operationalState, 'completed');
  assert.equal(normalizeOperationalSale({ channel:'shopee', external_sale_id:'2', status:'cancelled', total_cents:1234, occurred_at:'2026-09-01T12:00:00Z' }).operationalState, 'cancelled');
  assert.equal(normalizeOperationalSale({ channel:'shopee', external_sale_id:'3', status:'mystery', total_cents:1234, occurred_at:'2026-09-01T12:00:00Z' }).operationalState, 'pending');
});

test('ausência de documento permanece pendente, nunca vira sem nota automaticamente', () => {
  const sale = normalizeOperationalSale({ channel:'pdv', external_sale_id:'1', status:'completed', total_cents:1000, occurred_at:'2026-09-01T12:00:00Z' });
  assert.equal(reconcileSale(sale).fiscalState, 'reconciliation_pending');
  assert.equal(reconcileSale(sale, { classification:'no_invoice' }).fiscalState, 'no_invoice_confirmed');
});

test('documento autorizado prevalece e documento cancelado não conta como nota ativa', () => {
  const sale = normalizeOperationalSale({ channel:'pdv', external_sale_id:'1', status:'completed', total_cents:1000, occurred_at:'2026-09-01T12:00:00Z' });
  assert.equal(reconcileSale(sale, { documents:[{ status:'cancelled' }] }).fiscalState, 'reconciliation_pending');
  assert.equal(reconcileSale(sale, { classification:'no_invoice', documents:[{ status:'authorized', totalCents:1000 }] }).fiscalState, 'invoiced');
});

test('consolida valores por classificação e competência sem somar cancelada no operacional', () => {
  const rows = [
    { channel:'pdv', external_sale_id:'1', status:'completed', total_cents:1000, occurred_at:'2026-09-02T12:00:00Z' },
    { channel:'pdv', external_sale_id:'2', status:'completed', total_cents:2000, occurred_at:'2026-09-03T12:00:00Z' },
    { channel:'shopee', external_sale_id:'3', status:'completed', total_cents:3000, occurred_at:'2026-08-03T12:00:00Z' },
    { channel:'pdv', external_sale_id:'4', status:'cancelled', total_cents:4000, occurred_at:'2026-09-04T12:00:00Z' },
    { channel:'online', external_sale_id:'5', status:'unknown', total_cents:5000, occurred_at:'2026-09-05T12:00:00Z' },
  ];
  const fiscal = new Map([
    ['pdv:1', { documents:[{ status:'authorized' }] }],
    ['pdv:2', { classification:'no_invoice' }],
  ]);
  const report = buildRevenueReport(rows, fiscal);
  assert.deepEqual(report.totals, { operationalCents:6000, invoicedCents:1000, noInvoiceConfirmedCents:2000, reconciliationPendingCents:3000, cancelledCents:4000, operationalPendingCents:5000 });
  assert.deepEqual(report.months.map(month => month.competence), ['2026-09','2026-08']);
});

test('valida período explícito', () => {
  assert.equal(validPeriod('2026-01-01','2026-01-31'), true);
  assert.equal(validPeriod('2026-02-01','2026-01-31'), false);
  assert.equal(validPeriod('01/01/2026','2026-01-31'), false);
  assert.equal(validPeriod('2026-02-31','2026-03-01'), false);
  assert.equal(validPeriod('2025-01-01','2026-12-31'), false);
});

test('nega empresa sem concessão e aceita somente a empresa vinculada ao contador', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler: options.preHandler, handler });
  const profile = { id:'profile-a', settings_id:null, cnpj:'123', name:'Empresa A', regime:'simples_nacional', crt:'1' };
  const pool = {
    async query(sql, params = []) {
      if (sql.includes('FROM company_fiscal_profiles WHERE id=')) return [params[0] === 'company-a' ? [profile] : []];
      if (sql.includes('FROM company_accountant_access WHERE')) return [params[1] === 'customer-allowed' ? [{ id:'grant-1' }] : []];
      throw new Error(`SQL inesperado no teste: ${sql}`);
    },
  };
  let currentCustomer = 'customer-denied';
  registerAccountantPortalRoutes(app, { pool, enabled:true, getBearerAuthContext: async () => ({ customerId:currentCustomer, userId:currentCustomer, isAdmin:false }) });
  const route = routes.get('get:/accountant/companies/:id/revenue');
  const deniedReply = { sent:false, status:200, header(){}, code(value){ this.status=value; return this; }, send(value){ this.sent=true; this.body=value; return value; } };
  await route.preHandler({ params:{ id:'company-a' } }, deniedReply);
  assert.equal(deniedReply.status, 403);
  assert.equal(deniedReply.sent, true);
  currentCustomer = 'customer-allowed';
  const allowedRequest = { params:{ id:'company-a' } };
  const allowedReply = { sent:false, header(){}, code(){ return this; }, send(value){ this.sent=true; return value; } };
  await route.preHandler(allowedRequest, allowedReply);
  assert.equal(allowedReply.sent, false);
  assert.equal(allowedRequest.accountantProfile.id, 'profile-a');
});
