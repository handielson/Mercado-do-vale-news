const { randomUUID } = require('node:crypto');
const { problem, normalizeCnpj, validateProfile, inspectIssuerReadiness, lookupCnpj } = require('./companyFiscalCore.cjs');
const defaultCertificateVault = require('./fiscalCertificateVault.cjs');
const defaultCscVault = require('./fiscalCscVault.cjs');
const defaultNfceTransmission = require('./fiscalNfceTransmission.cjs');
const { inspectNfceSale } = require('./fiscalNfceSalePreflight.cjs');
const defaultNfceSalePreparation = require('./fiscalNfceSalePreparation.cjs');
const defaultNfceDanfeRead = require('./fiscalNfceDanfeRead.cjs');
const { configureNfceSequence } = require('./fiscalNfceNumbering.cjs');
const { blingReference, normalizeTaxValidation, taxValidationView, applyOperationReviews } = require('./fiscalTaxValidationCore.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SETTINGS_SQL = 'SELECT id,cnpj,name,company_name,razao_social,state_registration,cnae,porte,phone,email,social_website,address_state,address_zip_code,address_street,address_number,address_complement,address_neighborhood,address_city FROM company_settings LIMIT 1';
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const certificateView = (row, today = new Date()) => {
  const validUntil = row?.valid_until ? String(row.valid_until instanceof Date ? row.valid_until.toISOString() : row.valid_until).slice(0, 10) : '';
  const alertDays = Number(row?.alert_days || 30);
  const daysRemaining = validUntil ? Math.ceil((Date.parse(validUntil + 'T12:00:00Z') - Date.parse(today.toISOString().slice(0, 10) + 'T12:00:00Z')) / 86400000) : null;
  return {
    validUntil, alertDays, certificateType: row?.certificate_type || 'A1_SERVER', verifiedLocally: !!row?.verified_locally,
    installed: !!row?.installed_at, installedAt: row?.installed_at ? new Date(row.installed_at).toISOString() : '',
    subjectName: row?.subject_name || '', issuerName: row?.issuer_name || '', serialNumber: row?.serial_number || '', fingerprintSha256: row?.fingerprint_sha256 || '',
    sefaz: row?.last_sefaz_checked_at ? { environment: row.last_sefaz_environment || '', cStat: row.last_sefaz_status || '', reason: row.last_sefaz_reason || '', operational: row.last_sefaz_status === '107', checkedAt: new Date(row.last_sefaz_checked_at).toISOString() } : null,
    daysRemaining, alert: daysRemaining !== null && daysRemaining <= alertDays,
  };
};
const addressFrom = row => ({ zipCode: row.address_zip_code || '', street: row.address_street || '', number: row.address_number || '', complement: row.address_complement || '', neighborhood: row.address_neighborhood || '', city: row.address_city || '' });
function view(row) {
  return { id: row.settings_id ? 'primary' : row.id, primary: !!row.settings_id, identitySource: row.settings_id ? 'company_settings' : 'fiscal_profile', cnpj: row.cnpj, name: row.name,
    legalName: row.legal_name || '', stateRegistration: row.state_registration || '', stateRegistrationExempt: !!row.state_registration_exempt, municipalRegistration: row.municipal_registration || '',
    suframaRegistration: row.suframa_registration || '', cnae: row.cnae || '', cnaeActivities: parse(row.cnae_activities) || [], companySize: row.company_size || '', mainActivity: row.main_activity || '',
    segments: row.business_segments ? row.business_segments.split(',') : [], annualRevenueBand: row.annual_revenue_band || '', employeesBand: row.employees_band || '',
    contactPerson: row.contact_person || '', phone: row.phone || '', mobilePhone: row.mobile_phone || '', email: row.email || '', billingEmail: row.billing_email || '', website: row.website || '', substituteStateRegistrations: parse(row.substitute_state_registrations) || [],
    uf: row.uf || '', municipalityCode: row.municipality_code || '', address: addressFrom(row),
    regime: row.regime || 'nao_definido', crt: row.crt || '', effectiveFrom: row.effective_from ? String(row.effective_from instanceof Date ? row.effective_from.toISOString() : row.effective_from).slice(0, 10) : '',
    notes: row.notes || '', version: Number(row.version || 0), lookup: parse(row.lookup_json) || null };
}
function primaryView(settings, row) {
  const base = view(row || { settings_id: settings.id, version: 0 });
  // Operational identity stays canonical in company_settings; never overwrite it here.
  return { ...base, cnpj: normalizeCnpj(settings.cnpj), name: settings.name || settings.company_name || '', legalName: settings.razao_social || '', stateRegistration: settings.state_registration || '', cnae: settings.cnae || '', companySize: settings.porte || '', phone: settings.phone || '', email: settings.email || '', website: settings.social_website || '', uf: settings.address_state || '', address: addressFrom(settings), identityConflict: !!row && row.cnpj !== normalizeCnpj(settings.cnpj) };
}
function registerCompanyFiscalRoutes(app, { pool, getBearerAuthContext, enabled = process.env.MDV_COMPANY_FISCAL_ENABLED === '1', lookup = lookupCnpj, municipalityLookupFetch = fetch, certificateVault = defaultCertificateVault, cscVault = defaultCscVault,
  nfceTransmission = defaultNfceTransmission, nfceHomologationEnabled = process.env.MDV_NFCE_HOMOLOGATION_TRANSMIT_ENABLED === '1',
  nfceSalePreparation = defaultNfceSalePreparation, nfceHomologationPrepareEnabled = process.env.MDV_NFCE_HOMOLOGATION_PREPARE_ENABLED === '1',
  nfceDanfeRead = defaultNfceDanfeRead }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.fiscalActor = String(auth.userId);
  };
  app.get('/admin/fiscal-companies', { preHandler: admin }, async () => {
    if (!enabled) return { enabled: false, companies: [] };
    const [settings] = await pool.query(SETTINGS_SQL);
    const [rows] = await pool.query('SELECT * FROM company_fiscal_profiles ORDER BY created_at,id');
    const companies = rows.filter(r => !r.settings_id).map(view);
    if (settings[0]) companies.unshift(primaryView(settings[0], rows.find(r => r.settings_id === settings[0].id)));
    return { enabled: true, companies };
  });
  app.get('/admin/cnpj-lookup/:cnpj', { preHandler: admin, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    return lookup(req.params.cnpj);
  });
  app.get('/admin/fiscal-companies/:id/readiness', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const found = await locate(pool, req.params.id);
    return inspectIssuerReadiness(found.current, { fetchImpl: municipalityLookupFetch });
  });
  app.get('/admin/fiscal-companies/:id/tax-validation', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    const [rows] = await pool.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=?', [found.row.id]);
    return taxValidationView(rows[0]);
  });
  app.get('/admin/fiscal-certificates/alerts', { preHandler: admin }, async () => {
    if (!enabled) return { alerts: [] };
    const [settings] = await pool.query(SETTINGS_SQL);
    const [rows] = await pool.query('SELECT p.id,p.settings_id,p.name,c.* FROM company_fiscal_profiles p JOIN company_certificate_settings c ON c.profile_id=p.id');
    return { alerts: rows.map(row => ({ companyId: row.settings_id && settings[0]?.id === row.settings_id ? 'primary' : row.id, companyName: row.name, ...certificateView(row) })).filter(row => row.alert) };
  });
  app.get('/admin/fiscal-companies/:id/certificate', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const found = await locate(pool, req.params.id);
    if (!found.row) return certificateView(null);
    const [rows] = await pool.query('SELECT * FROM company_certificate_settings WHERE profile_id=?', [found.row.id]);
    return certificateView(rows[0]);
  });
  const write = async (req, reply) => {
    await admin(req, reply); if (reply.sent) return;
    if (!enabled) return reply.code(503).send({ error: 'Cadastro fiscal ainda não ativado no servidor.' });
  };
  app.get('/admin/fiscal-companies/:id/nfce-csc/:environment', { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    if (!['homologation', 'production'].includes(req.params.environment)) throw problem('Ambiente fiscal inválido.');
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    return cscVault.cscStatus(found.row.id, req.params.environment);
  });
  app.put('/admin/fiscal-companies/:id/nfce-csc/:environment', { preHandler: write, config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async req => {
    if (!['homologation', 'production'].includes(req.params.environment)) throw problem('Ambiente fiscal inválido.');
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    const { identifier, code } = req.body || {};
    const result = await cscVault.installCsc(found.row.id, req.params.environment, identifier, code);
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id, req.fiscalActor, 'nfce_csc_install', JSON.stringify({ environment: result.environment, identifier: result.identifier })]);
    return result;
  });
  const transaction = async fn => {
    const db = await pool.getConnection();
    try { await db.beginTransaction(); const result = await fn(db); await db.commit(); return result; }
    catch (e) { await db.rollback(); if (e.code === 'ER_DUP_ENTRY') throw problem('Este CNPJ já está cadastrado. Selecione a empresa existente.', 409); throw e; }
    finally { db.release(); }
  };
  async function locate(db, id, lock = false) {
    if (id !== 'primary' && !UUID.test(id || '')) throw problem('Empresa inválida.');
    if (id === 'primary') {
      const [settings] = await db.query(SETTINGS_SQL + (lock ? ' FOR UPDATE' : ''));
      if (!settings[0]) throw problem('Cadastre primeiro os dados da loja.', 404);
      const [rows] = await db.query('SELECT * FROM company_fiscal_profiles WHERE settings_id=?' + (lock ? ' FOR UPDATE' : ''), [settings[0].id]);
      if (rows[0] && rows[0].cnpj !== normalizeCnpj(settings[0].cnpj)) throw problem('O CNPJ da loja mudou. Revise o vínculo fiscal antes de continuar.', 409);
      return { row: rows[0], settings: settings[0], current: primaryView(settings[0], rows[0]) };
    }
    const [rows] = await db.query('SELECT * FROM company_fiscal_profiles WHERE id=? AND settings_id IS NULL' + (lock ? ' FOR UPDATE' : ''), [id]);
    if (!rows[0]) throw problem('Empresa não encontrada.', 404);
    return { row: rows[0], current: view(rows[0]) };
  }
  async function save(req, create) {
    return transaction(async db => {
      const found = create ? {} : await locate(db, req.params.id, true);
      const input = found.settings ? { ...req.body, ...Object.fromEntries(['cnpj', 'name', 'legalName', 'stateRegistration', 'cnae', 'companySize', 'phone', 'email', 'website', 'uf', 'address'].map(k => [k, found.current[k]])) } : req.body;
      const data = validateProfile(input);
      if ((found.row?.version || 0) !== data.version) throw problem('Cadastro alterado em outra sessão. Recarregue antes de salvar.', 409);
      if (found.row && data.cnpj !== found.row.cnpj) throw problem('Para outro CNPJ, cadastre uma nova empresa.');
      if (create) {
        const [settings] = await db.query(SETTINGS_SQL);
        if (settings[0] && data.cnpj === normalizeCnpj(settings[0].cnpj)) throw problem('Este é o CNPJ da loja. Selecione a empresa principal.', 409);
      }
      const id = found.row?.id || randomUUID();
      // The primary address is read only from company_settings; do not duplicate it in the fiscal registry.
      const address = found.settings ? { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '' } : data.address;
      const values = [data.cnpj, data.name, data.legalName, data.stateRegistration, data.municipalRegistration, data.uf, data.municipalityCode,
        address.zipCode, address.street, address.number, address.complement, address.neighborhood, address.city,
        data.regime, data.crt, data.effectiveFrom, data.notes, req.fiscalActor,
        data.suframaRegistration, data.cnae, data.companySize, data.mainActivity, data.segments.join(','), data.annualRevenueBand, data.employeesBand,
        data.contactPerson, data.phone, data.mobilePhone, data.email, data.billingEmail, data.website, JSON.stringify(data.substituteStateRegistrations), Number(data.stateRegistrationExempt), JSON.stringify(data.cnaeActivities)];
      if (found.row) await db.query('UPDATE company_fiscal_profiles SET cnpj=?,name=?,legal_name=?,state_registration=?,municipal_registration=?,uf=?,municipality_code=?,address_zip_code=?,address_street=?,address_number=?,address_complement=?,address_neighborhood=?,address_city=?,regime=?,crt=?,effective_from=?,notes=?,updated_by=?,suframa_registration=?,cnae=?,company_size=?,main_activity=?,business_segments=?,annual_revenue_band=?,employees_band=?,contact_person=?,phone=?,mobile_phone=?,email=?,billing_email=?,website=?,substitute_state_registrations=?,state_registration_exempt=?,cnae_activities=?,version=version+1 WHERE id=?', [...values, id]);
      else await db.query('INSERT INTO company_fiscal_profiles (cnpj,name,legal_name,state_registration,municipal_registration,uf,municipality_code,address_zip_code,address_street,address_number,address_complement,address_neighborhood,address_city,regime,crt,effective_from,notes,updated_by,suframa_registration,cnae,company_size,main_activity,business_segments,annual_revenue_band,employees_band,contact_person,phone,mobile_phone,email,billing_email,website,substitute_state_registrations,state_registration_exempt,cnae_activities,id,settings_id) VALUES (' + Array(36).fill('?').join(',') + ')', [...values, id, found.settings?.id || null]);
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [id, req.fiscalActor, 'manual_save', JSON.stringify({ before: found.current ? { regime: found.current.regime, crt: found.current.crt, effectiveFrom: found.current.effectiveFrom } : null, after: { regime: data.regime, crt: data.crt, effectiveFrom: data.effectiveFrom } })]);
      const [rows] = await db.query('SELECT * FROM company_fiscal_profiles WHERE id=?', [id]);
      return found.settings ? primaryView(found.settings, rows[0]) : view(rows[0]);
    });
  }
  app.post('/admin/fiscal-companies', { preHandler: write }, async (req, reply) => { const result = await save(req, true); reply.code(201); return result; });
  app.put('/admin/fiscal-companies/:id', { preHandler: write }, req => save(req, false));
  app.put('/admin/fiscal-companies/:id/certificate', { preHandler: write }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    const { validUntil, alertDays, certificateType } = req.body || {};
    if (validUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || new Date(validUntil).toISOString().slice(0, 10) !== validUntil)) throw problem('Validade do certificado inválida.');
    if (!Number.isInteger(alertDays) || alertDays < 1 || alertDays > 365) throw problem('Antecedência deve ser de 1 a 365 dias.');
    if (!['A1_SERVER','A1_CLIENT','A3','WINDOWS'].includes(certificateType)) throw problem('Tipo de certificado inválido.');
    await pool.query('INSERT INTO company_certificate_settings (profile_id,valid_until,alert_days,certificate_type,verified_locally,updated_by) VALUES (?,?,?,?,0,?) ON DUPLICATE KEY UPDATE valid_until=VALUES(valid_until),alert_days=VALUES(alert_days),certificate_type=VALUES(certificate_type),updated_by=VALUES(updated_by)', [found.row.id, validUntil || null, alertDays, certificateType, req.fiscalActor]);
    const [rows] = await pool.query('SELECT * FROM company_certificate_settings WHERE profile_id=?', [found.row.id]);
    return certificateView(rows[0]);
  });
  app.put('/admin/fiscal-companies/:id/tax-validation', { preHandler: write }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    const data = normalizeTaxValidation(req.body || {});
    const expectedVersion = Number(req.body?.version || 0);
    return transaction(async db => {
      const [rows] = await db.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=? FOR UPDATE', [found.row.id]);
      const current = rows[0];
      if (Number(current?.version || 0) !== expectedVersion) throw problem('A validação foi alterada em outra sessão. Recarregue antes de salvar.', 409);
      applyOperationReviews(data, current, req.body?.reviewRuleId, req.fiscalActor);
      const reviewedAt = data.reviewedAt || null;
      if (current) {
        await db.query('UPDATE company_fiscal_tax_validations SET status=?,reviewer_name=?,reviewer_registration=?,reviewed_at=?,notes=?,rules_json=?,version=version+1,updated_by=? WHERE profile_id=?', [data.status,data.reviewerName,data.reviewerRegistration,reviewedAt,data.notes,JSON.stringify({ rules:data.rules, generalDecisions:data.generalDecisions, productRules:data.productRules }),req.fiscalActor,found.row.id]);
      } else {
        await db.query('INSERT INTO company_fiscal_tax_validations (profile_id,status,reviewer_name,reviewer_registration,reviewed_at,notes,rules_json,bling_reference_json,updated_by) VALUES (?,?,?,?,?,?,?,?,?)', [found.row.id,data.status,data.reviewerName,data.reviewerRegistration,reviewedAt,data.notes,JSON.stringify({ rules:data.rules, generalDecisions:data.generalDecisions, productRules:data.productRules }),JSON.stringify(blingReference()),req.fiscalActor]);
      }
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id,req.fiscalActor,'tax_validation_save',JSON.stringify({ status: data.status, reviewerName: data.reviewerName, reviewedAt })]);
      const [saved] = await db.query('SELECT * FROM company_fiscal_tax_validations WHERE profile_id=?', [found.row.id]);
      return taxValidationView(saved[0]);
    });
  });
  app.post('/admin/fiscal-companies/:id/certificate/upload', { preHandler: write, config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve primeiro o cadastro fiscal da empresa.');
    let file = null; let password = ''; let alertDays = 30;
    for await (const part of req.parts({ limits: { files: 1, fields: 4, fileSize: certificateVault.MAX_PFX_BYTES || 5 * 1024 * 1024 } })) {
      if (part.type === 'file') {
        if (file) throw problem('Envie somente um certificado.');
        if (!/\.(pfx|p12)$/i.test(part.filename || '')) throw problem('Use um arquivo .pfx ou .p12.');
        file = await part.toBuffer();
      } else if (part.fieldname === 'password') password = String(part.value || '');
      else if (part.fieldname === 'alertDays') alertDays = Number(part.value);
    }
    if (!file) throw problem('Selecione o certificado A1.');
    if (!Number.isInteger(alertDays) || alertDays < 1 || alertDays > 365) throw problem('Antecedência deve ser de 1 a 365 dias.');
    const installed = await certificateVault.installCertificate(found.row.id, file, password, found.current.cnpj);
    await transaction(async db => {
      await db.query(`INSERT INTO company_certificate_settings
        (profile_id,valid_until,alert_days,certificate_type,verified_locally,storage_ref,fingerprint_sha256,subject_name,issuer_name,serial_number,installed_at,updated_by)
        VALUES (?,?,?,?,1,?,?,?,?,?,NOW(),?)
        ON DUPLICATE KEY UPDATE valid_until=VALUES(valid_until),alert_days=VALUES(alert_days),certificate_type='A1_SERVER',verified_locally=1,storage_ref=VALUES(storage_ref),fingerprint_sha256=VALUES(fingerprint_sha256),subject_name=VALUES(subject_name),issuer_name=VALUES(issuer_name),serial_number=VALUES(serial_number),installed_at=NOW(),last_sefaz_checked_at=NULL,last_sefaz_environment=NULL,last_sefaz_status=NULL,last_sefaz_reason=NULL,updated_by=VALUES(updated_by)`,
        [found.row.id, installed.validUntil, alertDays, 'A1_SERVER', installed.storageRef, installed.fingerprintSha256, installed.subjectName, installed.issuerName, installed.serialNumber, req.fiscalActor]);
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id, req.fiscalActor, 'certificate_install', JSON.stringify({ fingerprintSha256: installed.fingerprintSha256, validUntil: installed.validUntil })]);
    });
    return certificateView({ valid_until: installed.validUntil, alert_days: alertDays, certificate_type: 'A1_SERVER', verified_locally: true, installed_at: new Date(), ...Object.fromEntries([['subject_name',installed.subjectName],['issuer_name',installed.issuerName],['serial_number',installed.serialNumber],['fingerprint_sha256',installed.fingerprintSha256]]) });
  });
  app.post('/admin/fiscal-companies/:id/certificate/export', { preHandler: write, config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.', 404);
    const pfx = await certificateVault.exportCertificate(found.row.id, String(req.body?.password || ''));
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id, req.fiscalActor, 'certificate_export', JSON.stringify({ at: new Date().toISOString() })]);
    const cnpj = normalizeCnpj(found.current.cnpj);
    return reply.header('Content-Type', 'application/x-pkcs12').header('Content-Disposition', `attachment; filename="certificado-${cnpj}.pfx"`).header('Cache-Control', 'no-store').send(pfx);
  });
  app.post('/admin/fiscal-companies/:id/certificate/delete', { preHandler: write, config: { rateLimit: { max: 3, timeWindow: '10 minutes' } } }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.', 404);
    if (normalizeCnpj(req.body?.confirmation) !== normalizeCnpj(found.current.cnpj)) throw problem('Digite o CNPJ da empresa para confirmar a exclusão.');
    await certificateVault.deleteCertificate(found.row.id, String(req.body?.password || ''));
    await transaction(async db => {
      await db.query('UPDATE company_certificate_settings SET verified_locally=0,storage_ref=NULL,fingerprint_sha256=NULL,subject_name=NULL,issuer_name=NULL,serial_number=NULL,installed_at=NULL,last_sefaz_checked_at=NULL,last_sefaz_environment=NULL,last_sefaz_status=NULL,last_sefaz_reason=NULL,updated_by=? WHERE profile_id=?', [req.fiscalActor, found.row.id]);
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id, req.fiscalActor, 'certificate_delete', JSON.stringify({ at: new Date().toISOString() })]);
    });
    return { deleted: true };
  });
  app.post('/admin/fiscal-companies/:id/certificate/sefaz-status', { preHandler: write, config: { rateLimit: { max: 6, timeWindow: '10 minutes' } } }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.', 404);
    if (found.current.uf !== 'PE') throw problem('O teste direto está habilitado inicialmente para empresas de Pernambuco.');
    const result = await certificateVault.testSefaz(found.row.id, req.body?.environment || 'homologation');
    await transaction(async db => {
      await db.query('UPDATE company_certificate_settings SET last_sefaz_checked_at=?,last_sefaz_environment=?,last_sefaz_status=?,last_sefaz_reason=?,updated_by=? WHERE profile_id=?', [result.checkedAt.slice(0, 19).replace('T',' '), result.environment, result.cStat, result.reason, req.fiscalActor, found.row.id]);
      await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [found.row.id, req.fiscalActor, 'sefaz_status', JSON.stringify(result)]);
    });
    return result;
  });
  async function nfceAttempt(req) {
    if (!UUID.test(req.params.issuanceId || '')) throw problem('Tentativa NFC-e inválida.');
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.', 404);
    const [rows] = await pool.query(`SELECT id,profile_id,sale_id,environment,series,document_number,status,access_key,
      authorization_protocol,authorized_at,authorized_xml_sha256,last_error,created_at,updated_at
      FROM company_fiscal_nfce_issuances WHERE id=? AND profile_id=?`, [req.params.issuanceId, found.row.id]);
    if (!rows[0]) throw problem('Tentativa NFC-e não encontrada para esta empresa.', 404);
    return { row:rows[0], profileId:found.row.id };
  }
  app.get('/admin/fiscal-companies/:id/nfce/homologation', { preHandler:admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.',503);
    const found = await locate(pool,req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.',404);
    const [sequences] = await pool.query("SELECT series,next_number,checked_at FROM company_fiscal_nfce_sequences WHERE profile_id=? AND environment='homologation' ORDER BY series",[found.row.id]);
    const [certificates] = await pool.query('SELECT installed_at,valid_until FROM company_certificate_settings WHERE profile_id=? LIMIT 1',[found.row.id]);
    const [validations] = await pool.query('SELECT status FROM company_fiscal_tax_validations WHERE profile_id=? LIMIT 1',[found.row.id]);
    return { environment:'homologation', prepareEnabled:nfceHomologationPrepareEnabled, transmitEnabled:nfceHomologationEnabled,
      certificateInstalled:!!certificates[0]?.installed_at, certificateValidUntil:certificates[0]?.valid_until || null,
      csc:await cscVault.cscStatus(found.row.id,'homologation'), validationStatus:validations[0]?.status || 'draft',
      sequences:sequences.map(row=>({series:row.series,nextNumber:row.next_number,checkedAt:row.checked_at})) };
  });
  app.post('/admin/fiscal-companies/:id/nfce/homologation/sequence', { preHandler:write, config:{ rateLimit:{ max:3,timeWindow:'10 minutes' } } }, async req => {
    const found = await locate(pool,req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.',404);
    if (req.body?.confirmation !== 'CONFERI A SERIE DE HOMOLOGACAO') throw problem('Confirme a série e o último número de homologação antes de reservar.',409);
    const result = await configureNfceSequence(pool,{profileId:found.row.id,environment:'homologation',
      series:req.body?.series,blingLastNumber:req.body?.lastNumber,actor:req.fiscalActor});
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
      [found.row.id,req.fiscalActor,'nfce_homologation_sequence',JSON.stringify({series:result.series,nextNumber:result.nextNumber})]);
    return result;
  });
  app.get('/admin/fiscal-companies/:id/nfce/sales/:saleId/preflight', { preHandler:admin, config:{ rateLimit:{ max:12, timeWindow:'1 minute' } } }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.', 404);
    return inspectNfceSale(pool, { profileId:found.row.id, settingsId:found.row.settings_id, saleId:req.params.saleId });
  });
  app.get('/admin/fiscal-companies/:id/nfce/sales/:saleId/authorized-danfe', { preHandler:admin, config:{ rateLimit:{ max:12,timeWindow:'1 minute' } } }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.',503);
    const found = await locate(pool,req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.',404);
    return nfceDanfeRead.authorizedDanfeForSale(pool,{profileId:found.row.id,saleId:req.params.saleId,cnpj:found.current.cnpj});
  });
  app.post('/admin/fiscal-companies/:id/nfce/sales/:saleId/prepare-homologation', { preHandler:write, config:{ rateLimit:{ max:2, timeWindow:'10 minutes' } } }, async req => {
    if (!nfceHomologationPrepareEnabled) throw problem('Preparação NFC-e de homologação ainda não habilitada no servidor.', 503);
    const found = await locate(pool,req.params.id);
    if (!found.row) throw problem('Empresa fiscal não encontrada.',404);
    if (!(await cscVault.cscStatus(found.row.id,'homologation')).configured) throw problem('Cadastre o CSC de homologação antes de preparar a NFC-e.',409);
    const result = await nfceSalePreparation.prepareHomologationNfceForSale(pool,{
      profileId:found.row.id,settingsId:found.row.settings_id,saleId:req.params.saleId,company:found.current,series:req.body?.series,
    });
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
      [found.row.id,req.fiscalActor,'nfce_homologation_prepare',JSON.stringify({issuanceId:result.issuanceId,status:result.status,existing:result.existing})]);
    return result;
  });
  const nfceRoute = '/admin/fiscal-companies/:id/nfce/issuances/:issuanceId';
  app.get(nfceRoute, { preHandler: admin }, async req => {
    if (!enabled) throw problem('Cadastro fiscal ainda não ativado no servidor.', 503);
    const { row } = await nfceAttempt(req);
    return row;
  });
  app.post(`${nfceRoute}/transmit`, { preHandler: write, config: { rateLimit: { max: 2, timeWindow: '10 minutes' } } }, async req => {
    if (!nfceHomologationEnabled) throw problem('Transmissão NFC-e de homologação ainda não habilitada no servidor.', 503);
    const { row, profileId } = await nfceAttempt(req);
    if (row.environment !== 'homologation' || row.status !== 'prepared') throw problem('Somente tentativa preparada de homologação pode ser transmitida.', 409);
    const result = await nfceTransmission.transmitPreparedNfce(pool, row.id);
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
      [profileId, req.fiscalActor, 'nfce_homologation_transmit', JSON.stringify({ issuanceId:row.id, state:result.state })]);
    return result;
  });
  app.post(`${nfceRoute}/reconcile`, { preHandler: write, config: { rateLimit: { max: 6, timeWindow: '10 minutes' } } }, async req => {
    const { row, profileId } = await nfceAttempt(req);
    if (row.environment !== 'homologation' || !['sending','uncertain'].includes(row.status)) throw problem('Somente tentativa inconclusiva de homologação pode ser consultada.', 409);
    const result = await nfceTransmission.reconcileNfceByKey(pool, row.id);
    await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
      [profileId, req.fiscalActor, 'nfce_homologation_reconcile', JSON.stringify({ issuanceId:row.id, state:result.state })]);
    return result;
  });
  const refreshing = new Map();
  app.post('/admin/fiscal-companies/:id/refresh', { preHandler: write, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async req => {
    const found = await locate(pool, req.params.id);
    if (!found.row) throw problem('Salve o cadastro fiscal antes de consultar.');
    if (!Number.isInteger(req.body?.version) || req.body.version !== Number(found.row.version)) throw problem('Recarregue a empresa antes de atualizar a consulta.', 409);
    const last = parse(found.row.lookup_json);
    if (last && Date.now() - Date.parse(last.consultedAt) < 60000) return found.current;
    if (refreshing.has(found.row.id)) throw problem('Já existe uma consulta em andamento para esta empresa.', 429);
    refreshing.set(found.row.id, true);
    try {
      const result = await lookup(found.current.cnpj);
      return await transaction(async db => {
        const current = await locate(db, req.params.id, true);
        if (Number(current.row.version) !== Number(found.row.version)) throw problem('A empresa foi alterada durante a consulta. Recarregue e tente novamente.', 409);
        // The lookup is informational. Manual regime, CRT, dates and identity stay intact.
        await db.query('UPDATE company_fiscal_profiles SET lookup_json=?,version=version+1,updated_by=? WHERE id=?', [JSON.stringify(result), req.fiscalActor, current.row.id]);
        await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [current.row.id, req.fiscalActor, 'cnpj_lookup', JSON.stringify(result)]);
        return { ...current.current, lookup: result, version: Number(current.row.version) + 1 };
      });
    } finally { refreshing.delete(found.row.id); }
  });
}
module.exports = { registerCompanyFiscalRoutes, view, primaryView };
