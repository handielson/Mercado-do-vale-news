const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRevenueReport, normalizeOperationalSale, reconcileSale, validPeriod } = require('../services/accountantPortalCore.cjs');
const { registerAccountantPortalRoutes } = require('../services/accountantPortalServer.cjs');
const { majorToCents, blingFiscalEmissionPeriod, normalizeBlingFiscalDocument, collectBlingFiscalDocuments, fiscalDocumentTotals } = require('../services/blingFiscalImportCore.cjs');
const { normalizeDocumentReview, documentReviewView } = require('../services/fiscalDocumentReviewCore.cjs');

test('conferência de cancelamento lê pedido atual e SEFAZ sem gravar nem cancelar', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler:options.preHandler, handler });
  const cnpj = '11222333000181';
  const accessKey = `262609${cnpj}550010000006991123456780`;
  const queries = [];
  const pool = { query: async (sql, params) => {
    queries.push(sql);
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', cnpj, name:'Empresa' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[{ id:'profile-1', settings_id:'settings-1', cnpj, uf:'PE' }]];
    if (sql.includes('FROM company_fiscal_documents')) return [[{ id:'note-1', model:'55', channel:'shopee', external_sale_id:'ORDER-1', access_key:accessKey, status:'authorized' }]];
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  let marketplaceReads = 0;
  let sefazReads = 0;
  registerAccountantPortalRoutes(app, { pool, enabled:true,
    getBearerAuthContext:async () => ({ customerId:'admin', userId:'admin', isAdmin:true }),
    getLiveMarketplaceOrder:async (channel, id) => { marketplaceReads++; assert.equal(channel,'shopee'); assert.equal(id,'ORDER-1'); return { order_sn:id, order_status:'CANCELLED' }; },
    consultSefazInvoice:async () => { sefazReads++; return { situation:'authorized', cStat:'100', authorizationProtocol:'126260000000001', authorizedAt:'2026-09-24T10:00:00-03:00' }; },
  });
  const route = routes.get('get:/admin/fiscal-companies/:id/fiscal-documents/:documentId/cancellation-assessment');
  const req = { params:{ id:'primary', documentId:'note-1' } };
  const reply = { sent:false, header(){}, code(){return this;}, send(){this.sent=true;} };
  await route.preHandler(req,reply);
  assert.equal(reply.sent,false);
  const result = await route.handler(req);
  assert.equal(result.action,'read_only');
  assert.equal(result.marketplace.cancelled,true);
  assert.equal(result.assessment.eligible,true);
  assert.equal(result.assessment.alert,null);
  assert.equal(marketplaceReads,1);
  assert.equal(sefazReads,1);
  assert(queries.every(sql => /^SELECT/u.test(sql)));
});

test('revisão da NF-e aceita rascunho e exige decisão, fonte e contador para concluir', () => {
  const draft = normalizeDocumentReview({ reviewState:'draft', fiscalAction:'pending', valueTreatment:'Em análise.' });
  assert.equal(draft.reviewState, 'draft');
  assert.equal(documentReviewView(null).version, 0);
  assert.throws(() => normalizeDocumentReview({ reviewState:'reviewed', fiscalAction:'pending' }), /tratamento dos valores/);
  assert.throws(() => normalizeDocumentReview({ reviewState:'invalid', fiscalAction:'pending' }), /Estado da revisão inválido/);
  assert.throws(() => normalizeDocumentReview({ reviewState:'draft', fiscalAction:'cancel_now' }), /Providência fiscal inválida/);
  const reviewed = normalizeDocumentReview({ reviewState:'reviewed', fiscalAction:'assess_return', valueTreatment:'Frete e desconto conferidos.', justification:'Verificar devolução.', evidenceNotes:'Consulta SEFAZ e pedido.', reviewerName:'Contador teste', reviewerRegistration:'CRC teste' });
  assert.equal(reviewed.fiscalAction, 'assess_return');
});

test('decisão por documento exige concessão e empresa, usa versão e não altera nota nem venda', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler:options.preHandler, handler });
  let grant = true;
  let documentVisible = true;
  let stored = null;
  const writes = [];
  const query = async (sql, params = []) => {
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', cnpj:'123', name:'Empresa' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[{ id:'profile-1', settings_id:'settings-1', cnpj:'123' }]];
    if (sql.includes('FROM company_accountant_access')) return [grant ? [{ id:'grant-1' }] : []];
    if (sql.includes('FROM company_fiscal_documents')) return [documentVisible ? [{ id:'note-1', model:'55', document_number:'000699', channel:'shopee', external_sale_id:'order-1', status:'authorized', total_cents:5791 }] : []];
    if (sql.includes('FROM company_fiscal_document_reviews')) return [stored ? [stored] : []];
    writes.push({ sql, params });
    if (sql.startsWith('INSERT INTO company_fiscal_document_reviews')) stored = { id:params[0], review_state:params[3], value_treatment:params[4], fiscal_action:params[5], justification:params[6], evidence_notes:params[7], reviewer_name:params[8], reviewer_registration:params[9], reviewed_at:params[10], version:1 };
    if (sql.startsWith('UPDATE company_fiscal_document_reviews')) stored = { ...stored, review_state:params[0], value_treatment:params[1], fiscal_action:params[2], justification:params[3], evidence_notes:params[4], reviewer_name:params[5], reviewer_registration:params[6], reviewed_at:params[7], version:stored.version+1 };
    return [[]];
  };
  const pool = { query, getConnection:async () => ({ query, beginTransaction:async()=>{}, commit:async()=>{}, rollback:async()=>{}, release(){} }) };
  registerAccountantPortalRoutes(app, { pool, enabled:true, getBearerAuthContext:async () => ({ customerId:'accountant-1', userId:'accountant-1', isAdmin:false }) });
  const path = '/accountant/companies/:id/fiscal-documents/:documentId/review';
  const get = routes.get(`get:${path}`);
  const post = routes.get(`post:${path}`);
  const req = { params:{ id:'primary', documentId:'note-1' }, body:{ reviewState:'draft', fiscalAction:'pending', valueTreatment:'Em análise.', version:0 } };
  const reply = () => ({ sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } });
  let res = reply(); await get.preHandler(req,res); assert.equal(res.sent,false);
  assert.equal((await get.handler(req)).review.version,0);
  res = reply(); await post.preHandler(req,res); assert.equal(res.sent,false);
  assert.equal((await post.handler(req)).review.version,1);
  assert.deepEqual(writes.map(item => item.sql.split(' ')[0]), ['INSERT','INSERT']);
  assert(writes.every(item => !/company_fiscal_documents|company_fiscal_sale_reconciliations|\bsales\b/u.test(item.sql)));
  await assert.rejects(() => post.handler(req), /alterada em outra sessão/);
  req.body = { reviewState:'reviewed', fiscalAction:'assess_return', valueTreatment:'Cupom conferido.', justification:'Análise documentada.', evidenceNotes:'Pedido e SEFAZ.', reviewerName:'Contador teste', reviewerRegistration:'CRC teste', version:1 };
  assert.equal((await post.handler(req)).review.reviewState,'reviewed');
  assert.equal(stored.version,2);
  documentVisible = false;
  await assert.rejects(() => get.handler(req), /não encontrado nesta empresa/);
  grant = false;
  res = reply(); await post.preHandler(req,res); assert.equal(res.sent,true);
});

test('filtra o dia completo na consulta fiscal do Bling', () => {
  assert.deepEqual(blingFiscalEmissionPeriod('2026-09-22', '2026-09-22'), { initial:'2026-09-22 00:00:00', final:'2026-09-22 23:59:59' });
});

test('normaliza NF-e e NFC-e do Bling em centavos sem depender do cache do navegador', () => {
  assert.equal(majorToCents('123.45'), 12345);
  const nfe = normalizeBlingFiscalDocument({ id:321, tipo:1, situacao:5, numero:'99', serie:'1', dataEmissao:'2026-09-10 12:30:00', valorNota:123.45, chaveAcesso:'1'.repeat(44), numeroPedidoLoja:'order-123' }, 'nfe');
  assert.deepEqual(nfe, { model:'55', channel:'bling', externalSaleId:'nfe:321', status:'authorized', accessKey:'1'.repeat(44), documentNumber:'99', series:'1', issuedAt:'2026-09-10 12:30:00', totalCents:12345, source:'bling_import', sourceReference:'321', marketplaceOrderId:'order-123' });
  const cancelled = normalizeBlingFiscalDocument({ id:322, tipo:1, situacao:2, dataEmissao:'2026-09-10', valorNota:10 }, 'nfce');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.totalCents, 1000);
  assert.equal(cancelled.marketplaceOrderId, null);
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
  const savedDocuments = [];
  const db = {
    beginTransaction: async () => actions.push('begin'),
    query: async (sql, params) => {
      if (sql.includes('FROM mobile_sale_events')) { actions.push('match'); return [params[0] === 'order-123' ? [{ channel:'shopee', external_id:'order-123' }] : [{ channel:'tiktok', external_id:'ORDER-456' }]]; }
      if (sql.includes('INSERT INTO company_fiscal_documents')) savedDocuments.push(params);
      actions.push(sql.includes('company_fiscal_documents') ? 'document' : 'event');
    },
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
    importBlingDocuments: async () => [
      { model:'55', channel:'bling', externalSaleId:'nfe:1', status:'authorized', accessKey:null, documentNumber:'1', series:'1', issuedAt:'2026-09-01 12:00:00', totalCents:1250, source:'bling_import', sourceReference:'1', marketplaceOrderId:'order-123' },
      { model:'55', channel:'bling', externalSaleId:'nfe:2', status:'authorized', accessKey:null, documentNumber:'2', series:'1', issuedAt:'2026-09-01 13:00:00', totalCents:900, source:'bling_import', sourceReference:'2', marketplaceOrderId:'order-456' },
    ],
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
  assert.deepEqual(actions, ['begin','match','document','match','document','event','commit','release']);
  assert.equal(savedDocuments[0][2], 'shopee');
  assert.equal(savedDocuments[0][3], 'order-123');
  assert.equal(savedDocuments[1][2], 'bling');
  assert.equal(savedDocuments[1][3], 'order-456');
  assert.equal(result.imported, 2);
  assert.equal(result.authorized, 2);
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

test('isola duas contas e empresas e não consulta vendas globais para empresa sem vínculo operacional', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler: options.preHandler, handler });
  const primary = { id:'profile-primary', settings_id:'settings-primary', name:'Empresa principal', cnpj:'111', regime:'simples_nacional', crt:'1' };
  const secondary = { id:'profile-secondary', settings_id:null, name:'Segunda empresa', cnpj:'222', regime:'nao_definido', crt:'' };
  const grants = new Map([['account-primary','profile-primary'], ['account-secondary','profile-secondary']]);
  const sqlSeen = [];
  let importedFromBling = 0;
  const pool = { query: async (sql, params = []) => {
    sqlSeen.push(sql);
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-primary', name:'Empresa principal', cnpj:'111' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[primary]];
    if (sql.includes('FROM company_fiscal_profiles WHERE id=')) return [params[0] === secondary.id ? [secondary] : []];
    if (sql.includes('SELECT DISTINCT p.* FROM company_fiscal_profiles')) return [[primary, secondary].filter(row => grants.get(params[0]) === row.id)];
    if (sql.includes('FROM company_accountant_access WHERE')) return [grants.get(params[1]) === params[0] ? [{ id:'grant' }] : []];
    if (sql.includes('FROM company_fiscal_tax_validations')) return [[{ profile_id:params[0], status:'draft', version:1 }]];
    throw new Error(`Consulta operacional indevida para empresa sem vínculo: ${sql}`);
  } };
  let customerId = 'account-primary';
  let isAdmin = false;
  registerAccountantPortalRoutes(app, { pool, enabled:true,
    getBearerAuthContext: async () => ({ customerId, userId:customerId, isAdmin }),
    importBlingDocuments: async () => { importedFromBling += 1; return []; },
  });
  const reply = () => ({ sent:false, status:200, header(){}, code(value){ this.status=value; return this; }, send(value){ this.sent=true; this.body=value; return value; } });
  const listRoute = routes.get('get:/accountant/companies');
  const revenueRoute = routes.get('get:/accountant/companies/:id/revenue');
  const validationRoute = routes.get('get:/accountant/companies/:id/tax-validation');
  for (const [account, ownId, otherId] of [
    ['account-primary','primary',secondary.id],
    ['account-secondary',secondary.id,'primary'],
  ]) {
    customerId = account;
    const listReq = {};
    await listRoute.preHandler(listReq, reply());
    const listed = await listRoute.handler(listReq);
    assert.deepEqual(listed.companies.map(company => company.id), [ownId]);
    assert.equal(listed.companies[0].revenueAvailable, ownId === 'primary');
    const deniedRevenue = { params:{ id:otherId }, query:{ from:'2026-09-01', to:'2026-09-30' } };
    const deniedReply = reply();
    await revenueRoute.preHandler(deniedRevenue, deniedReply);
    assert.equal(deniedReply.status, 403);
    assert.equal(deniedReply.sent, true);
    const deniedValidation = { params:{ id:otherId } };
    const deniedValidationReply = reply();
    await validationRoute.preHandler(deniedValidation, deniedValidationReply);
    assert.equal(deniedValidationReply.status, 403);
  }
  customerId = 'account-secondary';
  const secondaryRequest = { params:{ id:secondary.id }, query:{ from:'2026-09-01', to:'2026-09-30' } };
  const allowedReply = reply();
  await revenueRoute.preHandler(secondaryRequest, allowedReply);
  assert.equal(allowedReply.sent, false);
  const report = await revenueRoute.handler(secondaryRequest);
  assert.equal(report.coverage.available, false);
  assert.deepEqual(report.sales, []);
  assert.deepEqual(report.reviewSales, []);
  assert.deepEqual(report.documents, []);
  assert.equal(sqlSeen.some(sql => /FROM (?:sales|orders|mobile_sale_events|company_fiscal_documents)/u.test(sql)), false);
  customerId = 'admin';
  isAdmin = true;
  const importRoute = routes.get('post:/admin/fiscal-companies/:id/documents/preview-bling');
  const importRequest = { params:{ id:secondary.id }, body:{ from:'2026-09-01', to:'2026-09-30' } };
  const importReply = reply();
  await importRoute.preHandler(importRequest, importReply);
  assert.equal(importReply.sent, false);
  await assert.rejects(importRoute.handler(importRequest), /conexão atual do Bling pertence à empresa principal/);
  assert.equal(importedFromBling, 0);
});

test('sinaliza diferenças de valor e de situação sem reclassificar pedidos ou calcular imposto', () => {
  const rows = [
    { channel:'shopee', external_sale_id:'a', status:'completed', total_cents:5591, occurred_at:'2026-09-23T12:00:00Z' },
    { channel:'tiktok', external_sale_id:'b', status:'pending', total_cents:16610, occurred_at:'2026-09-23T12:00:00Z' },
    { channel:'shopee', external_sale_id:'c', status:'cancelled', total_cents:1000, occurred_at:'2026-09-23T12:00:00Z' },
    { channel:'pdv', external_sale_id:'d', status:'completed', total_cents:2000, occurred_at:'2026-09-23T12:00:00Z' },
  ];
  const fiscal = new Map([
    ['shopee:a', { documents:[{ status:'authorized', totalCents:5791, model:'55', number:'1' }] }],
    ['tiktok:b', { documents:[{ status:'authorized', totalCents:16610, model:'55', number:'2' }] }],
    ['shopee:c', { documents:[{ status:'authorized', totalCents:1000, model:'55', number:'3' }] }],
  ]);
  const report = buildRevenueReport(rows, fiscal);
  assert.deepEqual(report.reviewSales.map(sale => sale.externalSaleId), ['a','b','c']);
  assert.equal(report.sales[0].fiscalState, 'invoiced');
  assert.equal(report.sales[0].amountDifferenceCents, 200);
  assert.deepEqual(report.sales[0].reviewReasons, ['amount_difference']);
  assert.equal(report.sales[1].fiscalState, 'operational_pending');
  assert.deepEqual(report.sales[1].reviewReasons, ['operational_pending_with_document']);
  assert.equal(report.sales[2].fiscalState, 'cancelled');
  assert.deepEqual(report.sales[2].reviewReasons, ['cancelled_with_document']);
  assert.equal(report.sales[3].fiscalState, 'reconciliation_pending');
  assert.equal(report.totals.noInvoiceConfirmedCents, 0);
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

test('status do marketplace preserva a data da captura sem apresentá-lo como estado atual', () => {
  const sale = normalizeOperationalSale({
    channel:'tiktok', external_sale_id:'order-1', status:'AWAITING_SHIPMENT',
    total_cents:16610, occurred_at:'2026-09-23T09:53:13Z', status_captured_at:'2026-09-23T09:53:54Z',
  });
  assert.equal(sale.statusCapturedAt, '2026-09-23T09:53:54.000Z');
  assert.equal(sale.operationalState, 'pending');
  const note = { status:'authorized', totalCents:16610 };
  assert.deepEqual(reconcileSale(sale, { documents:[note] }).reviewReasons, ['operational_pending_with_document']);
  assert.equal(normalizeOperationalSale({ ...sale, status_captured_at:undefined }).statusCapturedAt, '');
});

test('nota emitida no dia mostra pedido de outro dia para revisão sem alterar totais operacionais', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (path, options, handler) => routes.set(`${method}:${path}`, { preHandler:options.preHandler, handler });
  const queries = [];
  const pool = { query: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', name:'Empresa', cnpj:'123' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[{ id:'profile-1', settings_id:'settings-1', name:'Empresa', cnpj:'123' }]];
    if (sql.includes('FROM mobile_sale_events') && sql.includes('external_id IN')) return [[{
      channel:'shopee', external_sale_id:'order-1', status:'READY_TO_SHIP', total_cents:2631,
      occurred_at:'2026-09-21 20:48:41', status_captured_at:'2026-09-22 08:52:04', customer_name:'',
    }]];
    if (sql.includes('FROM mobile_sale_events')) return [[]];
    if (sql.includes('FROM sales WHERE') || sql.includes('FROM orders WHERE')) return [[]];
    if (sql.includes('FROM company_fiscal_documents')) return [[{
      id:'note-1', profile_id:'profile-1', channel:'shopee', external_sale_id:'order-1',
      model:'55', status:'authorized', document_number:'000693', issued_at:'2026-09-22 05:52:12', total_cents:2438, source:'bling_import',
    }]];
    if (sql.includes('FROM company_fiscal_sale_reconciliations')) return [[]];
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  registerAccountantPortalRoutes(app, { pool, enabled:true, getBearerAuthContext:async () => ({ customerId:'admin', userId:'admin', isAdmin:true }) });
  const route = routes.get('get:/accountant/companies/:id/revenue');
  const req = { params:{ id:'primary' }, query:{ from:'2026-09-22', to:'2026-09-22' } };
  const reply = { sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } };
  await route.preHandler(req, reply);
  const report = await route.handler(req);
  assert.equal(report.documentTotals.authorizedDocumentCents, 2438);
  assert.equal(report.totals.operationalCents, 0);
  assert.deepEqual(report.sales, []);
  assert.equal(report.reviewSales.length, 1);
  assert.equal(report.reviewSales[0].externalSaleId, 'order-1');
  assert.equal(report.reviewSales[0].amountDifferenceCents, -193);
  assert.deepEqual(report.reviewSales[0].reviewReasons, ['amount_difference','sale_outside_period']);
  assert.deepEqual(queries.find(entry => entry.sql.includes('external_id IN')).params, ['order-1','2026-09-22 00:00:00','2026-09-23 00:00:00']);
  assert.equal(queries.every(entry => /^SELECT /u.test(entry.sql.trim())), true);
});

test('consulta SEFAZ de nota exige acesso à empresa e chave do emitente, sem gravar', async () => {
  const routes = new Map();
  const app = {};
  for (const method of ['get','put','post','delete']) app[method] = (route, options, handler) => routes.set(`${method}:${route}`, { preHandler:options.preHandler, handler });
  const seen = [];
  let allowAccess = true;
  let documentKey = '26260934719515000168550010000006991123456780';
  const pool = { query: async (sql, params = []) => {
    seen.push({ sql, params });
    if (sql.includes('FROM company_settings')) return [[{ id:'settings-1', cnpj:'34719515000168', name:'Empresa' }]];
    if (sql.includes('FROM company_fiscal_profiles WHERE settings_id=')) return [[{ id:'profile-1', settings_id:'settings-1', cnpj:'34719515000168', uf:'PE' }]];
    if (sql.includes('FROM company_accountant_access')) return [allowAccess ? [{ id:'grant-1' }] : []];
    if (sql.includes('FROM company_fiscal_documents')) return [[{
      id:'doc-1', model:'55', access_key:documentKey,
    }]];
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  let consulted = 0;
  registerAccountantPortalRoutes(app, { pool, enabled:true,
    getBearerAuthContext:async () => ({ customerId:'accountant-1', userId:'accountant-1', isAdmin:false }),
    consultSefazInvoice:async (profileId, key, environment) => {
      consulted += 1;
      assert.equal(profileId, 'profile-1'); assert.equal(key.slice(6,20), '34719515000168'); assert.equal(environment, 'production');
      return { cStat:'100', situation:'authorized', reason:'Autorizado', checkedAt:'2026-09-23T23:00:00.000Z' };
    },
  });
  const route = routes.get('post:/accountant/companies/:id/fiscal-documents/:documentId/sefaz-status');
  const req = { params:{ id:'primary', documentId:'doc-1' } };
  const reply = { sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } };
  await route.preHandler(req, reply);
  assert.equal(reply.sent, false);
  assert.equal((await route.handler(req)).situation, 'authorized');
  assert.equal(consulted, 1);
  assert.deepEqual(seen.find(item => item.sql.includes('FROM company_fiscal_documents')).params, ['doc-1','profile-1']);
  assert.equal(seen.every(item => /^SELECT /u.test(item.sql.trim())), true);
  documentKey = '26260900000000000000550010000006991123456780';
  await assert.rejects(() => route.handler(req), /CNPJ da chave não corresponde/);
  assert.equal(consulted, 1);
  allowAccess = false;
  const denied = { params:{ id:'primary', documentId:'doc-1' } };
  const deniedReply = { sent:false, header(){}, code(){ return this; }, send(){ this.sent=true; } };
  await route.preHandler(denied, deniedReply);
  assert.equal(deniedReply.sent, true);
  assert.equal(consulted, 1);
});
