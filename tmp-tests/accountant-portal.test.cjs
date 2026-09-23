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

test('prévia fiscal exige administrador, totaliza modelos e não inicia gravação', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler:options.preHandler, handler });
  let isAdmin = false;
  let collected = 0;
  let authorizedCents = 1250;
  const pool = {
    query: async sql => {
      if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', name:'Empresa', cnpj:'123' }]];
      if (sql.includes('FROM company_fiscal_profiles')) return [[{ id:'profile-1', settings_id:'settings-1', name:'Empresa' }]];
      throw new Error(`SQL inesperado: ${sql}`);
    },
    getConnection: async () => { throw new Error('Prévia não deve abrir transação.'); },
  };
  registerAccountantPortalRoutes(app, {
    pool, enabled:true,
    getBearerAuthContext: async () => ({ customerId:'user-1', userId:'user-1', isAdmin }),
    importBlingDocuments: async () => {
      collected += 1;
      return [
        { model:'55', status:'authorized', totalCents:authorizedCents },
        { model:'65', status:'cancelled', totalCents:300 },
      ];
    },
  });
  const route = routes.get('post:/admin/fiscal-companies/:id/documents/preview-bling');
  const req = { params:{ id:'primary' }, body:{ from:'2026-09-01', to:'2026-09-02' } };
  const reply = { sent:false, status:200, header(){}, code(value){ this.status=value; return this; }, send(){ this.sent=true; } };
  await route.preHandler(req, reply);
  assert.equal(reply.status, 403);
  assert.equal(collected, 0);
  isAdmin = true;
  reply.sent = false;
  await route.preHandler(req, reply);
  assert.equal(reply.sent, false);
  const preview = await route.handler(req);
  assert.equal(collected, 1);
  assert.equal(preview.count, 2);
  assert.match(preview.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(preview.totals, { authorizedDocumentCents:1250, authorizedDocumentCount:1, cancelledDocumentCents:300, cancelledDocumentCount:1 });
  assert.equal(preview.byModel[0].authorizedDocumentCount, 1);
  assert.equal(preview.byModel[1].cancelledDocumentCount, 1);
  assert.equal(JSON.stringify(preview).includes('accessKey'), false);
  const importRoute = routes.get('post:/admin/fiscal-companies/:id/documents/import-bling');
  authorizedCents = 1300;
  await importRoute.preHandler(req, reply);
  await assert.rejects(importRoute.handler({ ...req, body:{ ...req.body, fingerprint:preview.fingerprint } }), /mudaram desde a prévia/);
  assert.equal(collected, 2);
});

test('importação usa a prévia correspondente e grava somente após a conferência', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler:options.preHandler, handler });
  const actions = [];
  const db = {
    beginTransaction: async () => actions.push('begin'),
    query: async sql => { actions.push(sql.includes('company_fiscal_documents') ? 'document' : 'event'); },
    commit: async () => actions.push('commit'),
    rollback: async () => actions.push('rollback'),
    release: () => actions.push('release'),
  };
  const pool = {
    query: async sql => {
      if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', name:'Empresa', cnpj:'123' }]];
      if (sql.includes('FROM company_fiscal_profiles')) return [[{ id:'profile-1', settings_id:'settings-1', name:'Empresa' }]];
      throw new Error(`SQL inesperado: ${sql}`);
    },
    getConnection: async () => db,
  };
  registerAccountantPortalRoutes(app, {
    pool, enabled:true,
    getBearerAuthContext: async () => ({ customerId:'admin', userId:'admin', isAdmin:true }),
    importBlingDocuments: async () => [{ model:'55', channel:'bling', externalSaleId:'nfe:1', status:'authorized', accessKey:null, documentNumber:'1', series:'1', issuedAt:'2026-09-01 12:00:00', totalCents:1250, source:'bling_import', sourceReference:'1' }],
  });
  const req = { params:{ id:'primary' }, body:{ from:'2026-09-01', to:'2026-09-02' } };
  const reply = { sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } };
  const previewRoute = routes.get('post:/admin/fiscal-companies/:id/documents/preview-bling');
  await previewRoute.preHandler(req, reply);
  const preview = await previewRoute.handler(req);
  assert.deepEqual(actions, []);
  const importRoute = routes.get('post:/admin/fiscal-companies/:id/documents/import-bling');
  const importReq = { ...req, body:{ ...req.body, fingerprint:preview.fingerprint } };
  await importRoute.preHandler(importReq, reply);
  const result = await importRoute.handler(importReq);
  assert.deepEqual(actions, ['begin','document','event','commit','release']);
  assert.equal(result.imported, 1);
  assert.equal(result.authorized, 1);
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

test('relatório de faturamento usa colunas e valores monetários do schema MySQL real', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'put', 'post', 'delete']) app[method] = (route, options, handler) => routes.set(`${method}:${route}`, { preHandler: options.preHandler, handler });
  const profile = { id:'profile-1', settings_id:'settings-1', name:'Empresa', cnpj:'123', regime:'simples_nacional', crt:'1' };
  const sqlSeen = [];
  const pool = { query: async (sql, params = []) => {
    sqlSeen.push(sql);
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', name:'Empresa', cnpj:'123' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[profile]];
    if (sql.includes('FROM mobile_sale_events')) return [[]];
    if (sql.includes('FROM sales WHERE created_at>=')) return [[{ channel:'pdv', external_sale_id:'sale-1', status:'completed', total_cents:1250, occurred_at:'2026-09-10 12:00:00', customer_name:'' }]];
    if (sql.includes('FROM orders WHERE company_id=')) return [[{ channel:'online', external_sale_id:'order-1', status:'delivered', total_cents:2345, occurred_at:'2026-09-11 12:00:00', customer_name:'' }]];
    if (sql.includes('FROM company_fiscal_documents')) return [[]];
    if (sql.includes('FROM company_fiscal_sale_reconciliations')) return [[]];
    throw new Error(`SQL inesperado no teste: ${sql}`);
  } };
  registerAccountantPortalRoutes(app, { pool, enabled:true, getBearerAuthContext:async () => ({ customerId:'admin', userId:'admin', isAdmin:true }) });
  const route = routes.get('get:/accountant/companies/:id/revenue');
  const req = { params:{ id:'primary' }, query:{ from:'2026-09-01', to:'2026-09-30' } };
  const reply = { sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } };
  await route.preHandler(req, reply);
  const report = await route.handler(req);
  const salesQuery = sqlSeen.find(sql => sql.includes('FROM sales WHERE created_at>='));
  assert.match(salesQuery, /finalization_status/);
  assert.match(salesQuery, /payment_status/);
  assert.match(salesQuery, /total AS total_cents/);
  assert.doesNotMatch(salesQuery, /company_id/);
  assert.doesNotMatch(salesQuery, /COALESCE\(status/);
  const ordersQuery = sqlSeen.find(sql => sql.includes('FROM orders WHERE company_id='));
  assert.match(ordersQuery, /created_at/);
  assert.doesNotMatch(ordersQuery, /paid_at/);
  assert.match(ordersQuery, /total AS total_cents/);
  assert.equal(report.totals.operationalCents, 3595);
  assert.equal(report.totals.reconciliationPendingCents, 3595);
});
