const { createHash, randomUUID } = require('node:crypto');
const { problem } = require('./companyFiscalCore.cjs');
const { blingReference, normalizeTaxValidation, taxValidationView } = require('./fiscalTaxValidationCore.cjs');
const { buildRevenueReport, validPeriod } = require('./accountantPortalCore.cjs');
const { fiscalDocumentTotals } = require('./blingFiscalImportCore.cjs');

const parseJson = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

async function findProfile(pool, id) {
  if (id === 'primary') {
    const [settings] = await pool.query('SELECT id,cnpj,name,company_name FROM company_settings LIMIT 1');
    if (!settings[0]) throw problem('Empresa principal não encontrada.', 404);
    const [profiles] = await pool.query('SELECT * FROM company_fiscal_profiles WHERE settings_id=? LIMIT 1', [settings[0].id]);
    if (!profiles[0]) throw problem('Salve primeiro o cadastro fiscal da empresa.', 409);
    return { ...profiles[0], public_id: 'primary', display_name: settings[0].name || settings[0].company_name || profiles[0].name, operational_company_id: settings[0].id };
  }
  const [profiles] = await pool.query('SELECT * FROM company_fiscal_profiles WHERE id=? AND settings_id IS NULL LIMIT 1', [id]);
  if (!profiles[0]) throw problem('Empresa fiscal não encontrada.', 404);
  return { ...profiles[0], public_id: profiles[0].id, display_name: profiles[0].name, operational_company_id: null };
}

// sales e mobile_sale_events ainda não identificam a empresa; só a principal pode consumi-los.
const canUsePrimaryOperationalSource = profile => profile.public_id === 'primary' && Boolean(profile.operational_company_id);

function companyView(profile) {
  return {
    id: profile.public_id,
    profileId: profile.id,
    name: profile.display_name || profile.name,
    cnpj: profile.cnpj,
    regime: profile.regime || 'nao_definido',
    crt: profile.crt || '',
    effectiveFrom: profile.effective_from ? String(profile.effective_from).slice(0, 10) : '',
    revenueAvailable: canUsePrimaryOperationalSource(profile),
  };
}

function registerAccountantPortalRoutes(app, { pool, getBearerAuthContext, enabled = process.env.MDV_COMPANY_FISCAL_ENABLED === '1', importBlingDocuments }) {
  const auth = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const context = await getBearerAuthContext(req);
    if (!context?.customerId || !context?.userId) return reply.code(401).send({ error: 'Entre com a conta autorizada do contador.' });
    req.accountantAuth = context;
  };
  const admin = async (req, reply) => {
    await auth(req, reply);
    if (reply.sent) return;
    if (!req.accountantAuth.isAdmin) return reply.code(403).send({ error: 'Acesso administrativo necessário.' });
  };
  const requireCompanyAccess = permission => async (req, reply) => {
    await auth(req, reply);
    if (reply.sent) return;
    if (!enabled) return reply.code(503).send({ error: 'Cadastro fiscal ainda não ativado no servidor.' });
    const profile = await findProfile(pool, req.params.id);
    if (!req.accountantAuth.isAdmin) {
      const column = permission === 'edit' ? 'can_edit_tax_validation' : 'can_view_revenue';
      const [rows] = await pool.query(
        `SELECT id FROM company_accountant_access WHERE profile_id=? AND customer_id=? AND is_active=1 AND ${column}=1 LIMIT 1`,
        [profile.id, req.accountantAuth.customerId]
      );
      if (!rows[0]) return reply.code(403).send({ error: 'Esta conta não possui acesso a esta empresa.' });
    }
    req.accountantProfile = profile;
    req.accountantActor = String(req.accountantAuth.userId);
  };

  app.get('/accountant/companies', { preHandler: auth }, async req => {
    if (!enabled) return { enabled: false, companies: [] };
    const params = [];
    let where = '';
    if (!req.accountantAuth.isAdmin) {
      where = 'JOIN company_accountant_access a ON a.profile_id=p.id AND a.customer_id=? AND a.is_active=1';
      params.push(req.accountantAuth.customerId);
    }
    const [settings] = await pool.query('SELECT id,cnpj,name,company_name FROM company_settings LIMIT 1');
    const [rows] = await pool.query(`SELECT DISTINCT p.* FROM company_fiscal_profiles p ${where} ORDER BY p.created_at,p.id`, params);
    const companies = rows.map(row => companyView({
      ...row,
      public_id: row.settings_id && row.settings_id === settings[0]?.id ? 'primary' : row.id,
      display_name: row.settings_id && row.settings_id === settings[0]?.id ? (settings[0].name || settings[0].company_name || row.name) : row.name,
      operational_company_id: row.settings_id && row.settings_id === settings[0]?.id ? settings[0].id : null,
    }));
    return { enabled: true, companies };
  });

  app.get('/accountant/companies/:id/tax-validation', { preHandler: requireCompanyAccess('edit') }, async req => {
    const [rows] = await pool.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=? LIMIT 1', [req.accountantProfile.id]);
    return taxValidationView(rows[0]);
  });

  app.put('/accountant/companies/:id/tax-validation', { preHandler: requireCompanyAccess('edit') }, async req => {
    const data = normalizeTaxValidation(req.body || {});
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const [currentRows] = await db.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=? FOR UPDATE', [req.accountantProfile.id]);
      const current = currentRows[0];
      const submittedVersion = Number(req.body?.version || 0);
      if (current && submittedVersion !== Number(current.version || 0)) {
        throw problem('A validação foi alterada em outra sessão. Recarregue antes de salvar.', 409);
      }
      const reviewedAt = data.reviewedAt || null;
      const rulesJson = JSON.stringify({ rules: data.rules, generalDecisions: data.generalDecisions, productRules: data.productRules });
      if (current) {
        await db.query('UPDATE company_fiscal_tax_validations SET status=?,reviewer_name=?,reviewer_registration=?,reviewed_at=?,notes=?,rules_json=?,version=version+1,updated_by=? WHERE profile_id=?', [data.status,data.reviewerName,data.reviewerRegistration,reviewedAt,data.notes,rulesJson,req.accountantActor,req.accountantProfile.id]);
      } else {
        await db.query('INSERT INTO company_fiscal_tax_validations (profile_id,status,reviewer_name,reviewer_registration,reviewed_at,notes,rules_json,bling_reference_json,updated_by) VALUES (?,?,?,?,?,?,?,?,?)', [req.accountantProfile.id,data.status,data.reviewerName,data.reviewerRegistration,reviewedAt,data.notes,rulesJson,JSON.stringify(blingReference()),req.accountantActor]);
      }
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [req.accountantProfile.id,req.accountantActor,'accountant_validation_save',JSON.stringify({ status:data.status,reviewerName:data.reviewerName,reviewedAt })]);
      const [saved] = await db.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=?', [req.accountantProfile.id]);
      await db.commit();
      return taxValidationView(saved[0]);
    } catch (error) {
      await db.rollback();
      throw error;
    } finally { db.release(); }
  });

  app.get('/accountant/companies/:id/revenue', { preHandler: requireCompanyAccess('revenue') }, async req => {
    const from = String(req.query?.from || '').trim();
    const to = String(req.query?.to || '').trim();
    if (!validPeriod(from, to)) throw problem('Informe um período válido de até 366 dias no formato AAAA-MM-DD.');
    const toExclusive = new Date(`${to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const exclusiveDate = toExclusive.toISOString().slice(0, 10);
    const profile = req.accountantProfile;
    if (!canUsePrimaryOperationalSource(profile)) {
      return {
        company: companyView(profile), period: { from, to },
        coverage: { available: false, reason: 'Faturamento indisponível até que as vendas e eventos operacionais desta empresa sejam segregados.' },
        ...buildRevenueReport([]), documentTotals: fiscalDocumentTotals([]), documents: [],
      };
    }
    const [eventRows] = await pool.query(
      `SELECT channel,external_id AS external_sale_id,status,total_cents,occurred_at,customer_name
         FROM mobile_sale_events
        WHERE occurred_at>=? AND occurred_at<? ORDER BY occurred_at DESC LIMIT 10000`,
      [`${from} 00:00:00`, `${exclusiveDate} 00:00:00`]
    );
    const [pdvRows] = await pool.query(
      `SELECT 'pdv' AS channel,id AS external_sale_id,
              CASE
                WHEN LOWER(COALESCE(payment_status,'')) IN ('cancelled','canceled','refunded','return_refund','returned','to_return') THEN payment_status
                WHEN COALESCE(finalization_status,'success')='success' THEN 'completed'
                ELSE COALESCE(finalization_status,'pending')
              END AS status,
              total AS total_cents,created_at AS occurred_at,'' AS customer_name
         FROM sales WHERE created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 10000`,
      [`${from} 00:00:00`, `${exclusiveDate} 00:00:00`]
    );
    const [onlineRows] = await pool.query(
      `SELECT 'online' AS channel,id AS external_sale_id,COALESCE(status,'pending') AS status,total AS total_cents,created_at AS occurred_at,COALESCE(customer_name,'') AS customer_name
         FROM orders WHERE company_id=? AND created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 10000`,
      [profile.operational_company_id, `${from} 00:00:00`, `${exclusiveDate} 00:00:00`]
    );
    const byKey = new Map();
    for (const row of [...eventRows, ...pdvRows, ...onlineRows]) {
      const key = `${String(row.channel).toLowerCase()}:${row.external_sale_id}`;
      if (!byKey.has(key)) byKey.set(key, row);
    }
    const [documentRows] = await pool.query('SELECT * FROM company_fiscal_documents WHERE profile_id=? AND issued_at>=? AND issued_at<?', [profile.id, `${from} 00:00:00`, `${exclusiveDate} 00:00:00`]);
    const [reconciliationRows] = await pool.query('SELECT * FROM company_fiscal_sale_reconciliations WHERE profile_id=?', [profile.id]);
    const fiscalBySale = new Map();
    for (const row of reconciliationRows) fiscalBySale.set(`${row.channel}:${row.external_sale_id}`, { classification: row.classification, documents: [] });
    for (const row of documentRows) {
      const key = `${row.channel}:${row.external_sale_id}`;
      const item = fiscalBySale.get(key) || { classification: 'pending', documents: [] };
      item.documents.push({ id: row.id, model: row.model, status: row.status, accessKey: row.access_key, number: row.document_number, series: row.series, issuedAt: row.issued_at, totalCents: Number(row.total_cents || 0), source: row.source });
      fiscalBySale.set(key, item);
    }
    const report = buildRevenueReport([...byKey.values()], fiscalBySale);
    const documentTotals = fiscalDocumentTotals(documentRows);
    const documents = documentRows.map(row => ({
      model: row.model, status: row.status, channel: ['shopee', 'tiktok'].includes(row.channel) ? row.channel : 'unidentified',
      orderReference: /^(?:nfe|nfce):/u.test(String(row.external_sale_id || '')) ? null : row.external_sale_id,
      number: row.document_number, series: row.series, issuedAt: row.issued_at, totalCents: Number(row.total_cents || 0),
    })).sort((left, right) => String(right.issuedAt || '').localeCompare(String(left.issuedAt || '')));
    return {
      company: companyView(profile), period: { from, to },
      coverage: { available: true, sources: ['sales','orders','mobile_sale_events'], note: 'PDV e site vêm das bases operacionais; canais de marketplace dependem dos eventos já sincronizados. Vendas sem XML histórico permanecem pendentes de conciliação.' },
      ...report, documentTotals, documents,
    };
  });

  const collectFiscalDocuments = async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    if (typeof importBlingDocuments !== 'function') throw problem('Importador fiscal do Bling não configurado.', 503);
    const profile = await findProfile(pool, req.params.id);
    if (!canUsePrimaryOperationalSource(profile)) throw problem('A conexão atual do Bling pertence à empresa principal. Configure uma conexão própria antes de importar documentos desta empresa.', 409);
    const from = String(req.body?.from || '').trim();
    const to = String(req.body?.to || '').trim();
    if (!validPeriod(from, to)) throw problem('Informe um período válido de até 366 dias.');
    const documents = await importBlingDocuments(req, { from, to });
    const fingerprint = createHash('sha256').update(JSON.stringify({
      profileId: profile.id, from, to,
      documents: documents.map(document => [document.model, document.sourceReference, document.status, document.issuedAt, document.totalCents, document.accessKey, document.documentNumber, document.series, document.marketplaceOrderId]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    })).digest('hex');
    return { profile, from, to, documents, fingerprint };
  };

  app.post('/admin/fiscal-companies/:id/documents/preview-bling', { preHandler: admin, config: { rateLimit: { max: 2, timeWindow: '10 minutes' } } }, async req => {
    const { from, to, documents, fingerprint } = await collectFiscalDocuments(req);
    return {
      from, to, count: documents.length, fingerprint,
      totals: fiscalDocumentTotals(documents),
      byModel: ['55', '65'].map(model => ({ model, ...fiscalDocumentTotals(documents.filter(document => document.model === model)) })),
      source: 'bling_preview',
    };
  });

  app.post('/admin/fiscal-companies/:id/documents/import-bling', { preHandler: admin, config: { rateLimit: { max: 2, timeWindow: '10 minutes' } } }, async req => {
    const { profile, from, to, documents, fingerprint } = await collectFiscalDocuments(req);
    if (!/^[a-f0-9]{64}$/u.test(String(req.body?.fingerprint || '')) || req.body.fingerprint !== fingerprint) {
      throw problem('As notas mudaram desde a prévia. Confira o período novamente antes de importar.', 409);
    }
    let imported = 0;
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      for (const document of documents) {
        let channel = 'bling';
        let externalSaleId = document.marketplaceOrderId || document.externalSaleId;
        if (document.marketplaceOrderId) {
          const [candidateRows] = await db.query(
            "SELECT DISTINCT channel, external_id FROM mobile_sale_events WHERE external_id=? AND channel IN ('shopee','tiktok')",
            [document.marketplaceOrderId]
          );
          const matches = [...new Set(candidateRows.filter(row => String(row.external_id) === document.marketplaceOrderId).map(row => row.channel))];
          if (matches.length === 1) {
            channel = matches[0];
            externalSaleId = document.marketplaceOrderId;
          }
        }
        await db.query(
          `INSERT INTO company_fiscal_documents
            (id,profile_id,channel,external_sale_id,model,status,access_key,document_number,series,issued_at,total_cents,source,source_reference,created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE channel=VALUES(channel),external_sale_id=VALUES(external_sale_id),status=VALUES(status),access_key=COALESCE(VALUES(access_key),access_key),document_number=VALUES(document_number),series=VALUES(series),issued_at=VALUES(issued_at),total_cents=VALUES(total_cents),updated_at=CURRENT_TIMESTAMP`,
          [randomUUID(),profile.id,channel,externalSaleId,document.model,document.status,document.accessKey,document.documentNumber,document.series,document.issuedAt,document.totalCents,document.source,document.sourceReference,String(req.accountantAuth.userId)]
        );
        imported += 1;
      }
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [profile.id,String(req.accountantAuth.userId),'bling_fiscal_documents_import',JSON.stringify({ from,to,documents:imported })]);
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    } finally { db.release(); }
    return {
      imported,
      authorized: documents.filter(document => document.status === 'authorized').length,
      cancelled: documents.filter(document => document.status === 'cancelled').length,
      from, to, source: 'bling_import',
    };
  });

  app.get('/admin/fiscal-companies/:id/accountant-access', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const profile = await findProfile(pool, req.params.id);
    const [rows] = await pool.query(
      `SELECT a.id,a.customer_id,a.can_edit_tax_validation,a.can_view_revenue,a.is_active,a.created_at,a.updated_at,c.name,c.email
         FROM company_accountant_access a JOIN customers c ON c.id=a.customer_id
        WHERE a.profile_id=? ORDER BY a.is_active DESC,c.name`, [profile.id]
    );
    return { company: companyView(profile), access: rows.map(row => ({ ...row, can_edit_tax_validation: !!row.can_edit_tax_validation, can_view_revenue: !!row.can_view_revenue, is_active: !!row.is_active })) };
  });

  app.post('/admin/fiscal-companies/:id/accountant-access', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const profile = await findProfile(pool, req.params.id);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw problem('Informe o e-mail da conta do contador.');
    const [customers] = await pool.query('SELECT c.id,c.name,c.email,c.customer_type FROM customer_auth a JOIN customers c ON c.id=a.customer_id WHERE LOWER(a.email)=? LIMIT 1', [email]);
    if (!customers[0]) throw problem('O contador precisa criar a conta antes de receber o acesso.', 404);
    if (String(customers[0].customer_type || '').toUpperCase() === 'ADMIN') throw problem('A conta administrativa já possui acesso e não precisa ser adicionada.', 409);
    await pool.query(
      `INSERT INTO company_accountant_access (id,profile_id,customer_id,can_edit_tax_validation,can_view_revenue,is_active,created_by)
       VALUES (?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE can_edit_tax_validation=VALUES(can_edit_tax_validation),can_view_revenue=VALUES(can_view_revenue),is_active=1,revoked_by=NULL,revoked_at=NULL,updated_at=CURRENT_TIMESTAMP`,
      [randomUUID(),profile.id,customers[0].id,req.body?.canEditTaxValidation!==false?1:0,req.body?.canViewRevenue!==false?1:0,String(req.accountantAuth.userId)]
    );
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [profile.id,String(req.accountantAuth.userId),'accountant_access_grant',JSON.stringify({ customerId:customers[0].id,email })]);
    return { granted: true, customer: customers[0] };
  });

  app.delete('/admin/fiscal-companies/:id/accountant-access/:customerId', { preHandler: admin }, async req => {
    const profile = await findProfile(pool, req.params.id);
    await pool.query('UPDATE company_accountant_access SET is_active=0,revoked_by=?,revoked_at=NOW() WHERE profile_id=? AND customer_id=?', [String(req.accountantAuth.userId),profile.id,req.params.customerId]);
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [profile.id,String(req.accountantAuth.userId),'accountant_access_revoke',JSON.stringify({ customerId:req.params.customerId })]);
    return { revoked: true };
  });
}

module.exports = { registerAccountantPortalRoutes, findProfile };
