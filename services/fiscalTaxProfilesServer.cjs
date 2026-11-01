// Rotas dos perfis fiscais por produto (Espaço do Contador e admin).
// Acesso: requireEdit = requireCompanyAccess('edit') do portal do contador (contadora com permissão ou admin).
// Só cadastro: não emite nota, não reserva numeração e não altera NCM/CEST do produto
// (o cadastro do produto continua sendo a fonte e sincroniza com o Bling).
const crypto = require('crypto');
const { problem } = require('./companyFiscalCore.cjs');
const core = require('./fiscalTaxProfileCore.cjs');
const defaultCatalog = require('./fiscalCatalog.cjs');

const PRODUCT_COLUMNS = 'id,name,sku,ncm,cest,origin,status,is_parent,is_virtual,is_combo,parent_id';
const FILTERS = new Set(['all', 'missing_profile', 'not_ready', 'ncm_invalid', 'ready']);

function registerFiscalTaxProfileRoutes(app, { pool, requireEdit, requireAuth, catalog = defaultCatalog }) {
  if (!pool || !requireEdit || !requireAuth) throw new Error('registerFiscalTaxProfileRoutes: pool, requireEdit e requireAuth são obrigatórios.');
  const rate = (max) => ({ rateLimit: { max, timeWindow: '1 minute' } });
  const event = (db, req, name, details) => db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
    [req.accountantProfile.id, req.accountantActor, name, JSON.stringify(details)]);

  async function listProfiles(db, companyId) {
    const [rows] = await db.query('SELECT * FROM company_fiscal_tax_profiles WHERE company_profile_id=? ORDER BY name', [companyId]);
    return rows.map(core.profileView);
  }
  async function findProfile(db, companyId, id, lock = false) {
    if (!core.UUID.test(String(id || ''))) throw problem('Perfil fiscal inválido.', 400);
    const [rows] = await db.query(`SELECT * FROM company_fiscal_tax_profiles WHERE id=? AND company_profile_id=? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id, companyId]);
    if (!rows[0]) throw problem('Perfil fiscal não encontrado nesta empresa.', 404);
    return rows[0];
  }
  const settingsView = row => row ? { taxProfileId: row.tax_profile_id || null, version: Number(row.version || 1),
    overrides: typeof row.overrides_json === 'string' ? JSON.parse(row.overrides_json) : (row.overrides_json || {}), updatedBy: row.updated_by, updatedAt: row.updated_at } : null;

  function productView(product, settings, profilesById, profiles) {
    const profile = settings?.taxProfileId ? profilesById.get(settings.taxProfileId) || null : null;
    const ncmCheck = catalog.lookupNcm(product.ncm);
    const nfce = core.resolveProductTax({ product, settings, profile, model: '65', catalog });
    const nfe = core.resolveProductTax({ product, settings, profile, model: '55', destination: 'internal', catalog });
    return {
      id: product.id, name: product.name, sku: product.sku, status: product.status, isVirtual: !!product.is_virtual,
      ncm: { raw: product.ncm || '', ...ncmCheck }, cest: String(product.cest || '').replace(/\D/g, ''), origin: product.origin ?? '',
      settings, profile: profile ? { id: profile.id, name: profile.name, status: profile.status } : null,
      suggestedProfile: core.suggestProfile(profiles, product.ncm),
      readiness: { nfce: { ready: nfce.ready, issues: nfce.issues, cfop: nfce.fields.cfop, csosn: nfce.fields.csosn },
        nfe: { ready: profile ? nfe.ready : false, issues: nfe.issues, cfop: nfe.fields.cfop, csosn: nfe.fields.csosn } },
    };
  }

  // ---------- Tabelas oficiais ----------
  app.get('/accountant/fiscal-catalog/info', { preHandler: requireAuth }, async () => ({ ...catalog.info(), csosn: core.CSOSN }));
  app.get('/accountant/fiscal-catalog/ncm', { preHandler: requireAuth, config: rate(60) }, async req => ({ items: catalog.searchNcm(String(req.query?.search || ''), { limit: req.query?.limit }) }));
  app.get('/accountant/fiscal-catalog/ncm/:code', { preHandler: requireAuth, config: rate(120) }, async req => {
    const result = catalog.lookupNcm(req.params.code);
    return { ...result, cest: result.valid ? catalog.cestForNcm(result.code, { includeDoorToDoor: req.query?.doorToDoor === '1' }) : [] };
  });
  app.get('/accountant/fiscal-catalog/cest/:code', { preHandler: requireAuth, config: rate(120) }, async (req, reply) => {
    const item = catalog.lookupCest(req.params.code);
    if (!item) return reply.code(404).send({ error: 'CEST não encontrado no Convênio ICMS 142/2018 vigente.' });
    return { ...item, matchesNcm: req.query?.ncm ? catalog.cestMatchesNcm(item.code, req.query.ncm) : undefined };
  });

  // ---------- Perfis ----------
  app.get('/accountant/companies/:id/tax-profiles', { preHandler: requireEdit }, async req => {
    const profiles = await listProfiles(pool, req.accountantProfile.id);
    const [counts] = await pool.query('SELECT tax_profile_id, COUNT(*) AS total FROM product_fiscal_settings WHERE company_profile_id=? AND tax_profile_id IS NOT NULL GROUP BY tax_profile_id', [req.accountantProfile.id]);
    const byProfile = new Map(counts.map(row => [row.tax_profile_id, Number(row.total)]));
    return { profiles: profiles.map(p => ({ ...p, productCount: byProfile.get(p.id) || 0 })), csosn: core.CSOSN };
  });

  app.post('/accountant/companies/:id/tax-profiles', { preHandler: requireEdit }, async (req, reply) => {
    const { profile, warnings } = core.normalizeProfile(req.body || {});
    const id = crypto.randomUUID();
    const { name, status, ...data } = profile;
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const [dupe] = await db.query('SELECT id FROM company_fiscal_tax_profiles WHERE company_profile_id=? AND name=? LIMIT 1', [req.accountantProfile.id, name]);
      if (dupe[0]) throw problem('Já existe um perfil com esse nome.', 409);
      await db.query('INSERT INTO company_fiscal_tax_profiles (id,company_profile_id,name,status,data_json,updated_by) VALUES (?,?,?,?,?,?)',
        [id, req.accountantProfile.id, name, status, JSON.stringify(data), req.accountantActor]);
      await event(db, req, 'tax_profile_create', { taxProfileId: id, name, status });
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    reply.code(201);
    return { profile: core.profileView((await pool.query('SELECT * FROM company_fiscal_tax_profiles WHERE id=?', [id]))[0][0]), warnings };
  });

  app.put('/accountant/companies/:id/tax-profiles/:profileId', { preHandler: requireEdit }, async req => {
    const { profile, warnings } = core.normalizeProfile(req.body || {});
    const { name, status, ...data } = profile;
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const current = await findProfile(db, req.accountantProfile.id, req.params.profileId, true);
      if (Number(req.body?.version || 0) !== Number(current.version)) throw problem('O perfil foi alterado em outra sessão. Recarregue antes de salvar.', 409);
      const [dupe] = await db.query('SELECT id FROM company_fiscal_tax_profiles WHERE company_profile_id=? AND name=? AND id<>? LIMIT 1', [req.accountantProfile.id, name, current.id]);
      if (dupe[0]) throw problem('Já existe um perfil com esse nome.', 409);
      await db.query('UPDATE company_fiscal_tax_profiles SET name=?,status=?,data_json=?,version=version+1,updated_by=? WHERE id=?', [name, status, JSON.stringify(data), req.accountantActor, current.id]);
      await event(db, req, 'tax_profile_update', { taxProfileId: current.id, name, status, previousStatus: current.status, version: Number(current.version) + 1 });
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    return { profile: core.profileView((await pool.query('SELECT * FROM company_fiscal_tax_profiles WHERE id=?', [req.params.profileId]))[0][0]), warnings };
  });

  app.delete('/accountant/companies/:id/tax-profiles/:profileId', { preHandler: requireEdit }, async req => {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const current = await findProfile(db, req.accountantProfile.id, req.params.profileId, true);
      const [used] = await db.query('SELECT COUNT(*) AS total FROM product_fiscal_settings WHERE company_profile_id=? AND tax_profile_id=?', [req.accountantProfile.id, current.id]);
      if (Number(used[0].total) > 0) throw problem(`Perfil em uso por ${used[0].total} produto(s). Troque o perfil desses produtos antes de excluir.`, 409);
      await db.query('DELETE FROM company_fiscal_tax_profiles WHERE id=?', [current.id]);
      await event(db, req, 'tax_profile_delete', { taxProfileId: current.id, name: current.name });
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    return { deleted: true };
  });

  // ---------- Produtos ----------
  app.get('/accountant/companies/:id/fiscal-products', { preHandler: requireEdit, config: rate(30) }, async req => {
    const companyId = req.accountantProfile.id;
    const filter = FILTERS.has(req.query?.filter) ? req.query.filter : 'all';
    const search = String(req.query?.search || '').trim().toLowerCase().slice(0, 80);
    const page = Math.max(1, Math.min(Number(req.query?.page) || 1, 1000));
    const pageSize = Math.max(10, Math.min(Number(req.query?.pageSize) || 50, 200));
    const profiles = await listProfiles(pool, companyId);
    const profilesById = new Map(profiles.map(p => [p.id, p]));
    const [products] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE COALESCE(is_parent,0)=0 ORDER BY name`);
    const [settingsRows] = await pool.query('SELECT * FROM product_fiscal_settings WHERE company_profile_id=?', [companyId]);
    const settingsById = new Map(settingsRows.map(row => [String(row.product_id), settingsView(row)]));
    const all = products.map(p => productView(p, settingsById.get(String(p.id)) || null, profilesById, profiles));
    const summary = { total: all.length, withProfile: 0, missingProfile: 0, ncmInvalid: 0, nfceReady: 0, nfeReady: 0 };
    for (const p of all) {
      if (p.profile) summary.withProfile++; else summary.missingProfile++;
      if (!p.ncm.valid) summary.ncmInvalid++;
      if (p.readiness.nfce.ready) summary.nfceReady++;
      if (p.readiness.nfe.ready) summary.nfeReady++;
    }
    const filtered = all.filter(p => {
      if (search && !`${p.name || ''} ${p.sku || ''} ${p.ncm.raw}`.toLowerCase().includes(search)) return false;
      if (filter === 'missing_profile') return !p.profile;
      if (filter === 'ncm_invalid') return !p.ncm.valid;
      if (filter === 'ready') return p.readiness.nfce.ready;
      if (filter === 'not_ready') return !p.readiness.nfce.ready;
      return true;
    });
    return { summary, filter, page, pageSize, total: filtered.length, items: filtered.slice((page - 1) * pageSize, page * pageSize),
      profiles: profiles.map(p => ({ id: p.id, name: p.name, status: p.status })) };
  });

  app.get('/accountant/companies/:id/fiscal-products/:productId', { preHandler: requireEdit }, async (req, reply) => {
    const companyId = req.accountantProfile.id;
    if (!core.UUID.test(String(req.params.productId || ''))) throw problem('Produto inválido.', 400);
    const [rows] = await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id=? LIMIT 1`, [req.params.productId]);
    if (!rows[0]) return reply.code(404).send({ error: 'Produto não encontrado.' });
    const profiles = await listProfiles(pool, companyId);
    const [settings] = await pool.query('SELECT * FROM product_fiscal_settings WHERE company_profile_id=? AND product_id=? LIMIT 1', [companyId, rows[0].id]);
    const view = productView(rows[0], settingsView(settings[0]), new Map(profiles.map(p => [p.id, p])), profiles);
    const profile = view.profile ? profiles.find(p => p.id === view.profile.id) : null;
    const s = view.settings;
    return { ...view, cestOptions: view.ncm.valid ? catalog.cestForNcm(view.ncm.code) : [],
      resolved: { nfce: core.resolveProductTax({ product: rows[0], settings: s, profile, model: '65', catalog }),
        nfeInternal: core.resolveProductTax({ product: rows[0], settings: s, profile, model: '55', destination: 'internal', catalog }),
        nfeInterstate: core.resolveProductTax({ product: rows[0], settings: s, profile, model: '55', destination: 'interstate', catalog }) },
      issueText: core.ISSUE_TEXT };
  });

  app.put('/accountant/companies/:id/fiscal-products/:productId', { preHandler: requireEdit }, async req => {
    const companyId = req.accountantProfile.id;
    const productId = String(req.params.productId || '');
    if (!core.UUID.test(productId)) throw problem('Produto inválido.', 400);
    const taxProfileId = req.body?.taxProfileId ? String(req.body.taxProfileId) : null;
    const overrides = core.normalizeOverrides(req.body?.overrides || {});
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const [products] = await db.query('SELECT id FROM products WHERE id=? LIMIT 1', [productId]);
      if (!products[0]) throw problem('Produto não encontrado.', 404);
      if (taxProfileId) await findProfile(db, companyId, taxProfileId);
      const [currentRows] = await db.query('SELECT * FROM product_fiscal_settings WHERE company_profile_id=? AND product_id=? FOR UPDATE', [companyId, productId]);
      const current = currentRows[0];
      if (current && Number(req.body?.version || 0) !== Number(current.version)) throw problem('Este produto foi alterado em outra sessão. Recarregue antes de salvar.', 409);
      if (current) await db.query('UPDATE product_fiscal_settings SET tax_profile_id=?,overrides_json=?,version=version+1,updated_by=? WHERE company_profile_id=? AND product_id=?', [taxProfileId, JSON.stringify(overrides), req.accountantActor, companyId, productId]);
      else await db.query('INSERT INTO product_fiscal_settings (company_profile_id,product_id,tax_profile_id,overrides_json,updated_by) VALUES (?,?,?,?,?)', [companyId, productId, taxProfileId, JSON.stringify(overrides), req.accountantActor]);
      await event(db, req, 'product_fiscal_settings_save', { productId, taxProfileId, previousTaxProfileId: current?.tax_profile_id || null, overriddenFields: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, Object.keys(v)])) });
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    const [saved] = await pool.query('SELECT * FROM product_fiscal_settings WHERE company_profile_id=? AND product_id=?', [companyId, productId]);
    return { settings: settingsView(saved[0]) };
  });

  // Vincula vários produtos a um perfil. mode='suggested' aplica o perfil sugerido pelo NCM só em quem está sem perfil.
  app.post('/accountant/companies/:id/fiscal-products/assign', { preHandler: requireEdit, config: rate(10) }, async req => {
    const companyId = req.accountantProfile.id;
    const mode = req.body?.mode === 'suggested' ? 'suggested' : 'explicit';
    const db = await pool.getConnection();
    let changed = 0;
    try {
      await db.beginTransaction();
      const profiles = await listProfiles(db, companyId);
      const [existingRows] = await db.query('SELECT product_id, tax_profile_id FROM product_fiscal_settings WHERE company_profile_id=? FOR UPDATE', [companyId]);
      const existing = new Map(existingRows.map(row => [String(row.product_id), row.tax_profile_id]));
      let targets = [];
      if (mode === 'explicit') {
        const ids = [...new Set((Array.isArray(req.body?.productIds) ? req.body.productIds : []).map(String))];
        if (!ids.length || ids.length > 500 || ids.some(id => !core.UUID.test(id))) throw problem('Envie de 1 a 500 produtos válidos.', 400);
        const taxProfileId = req.body?.taxProfileId ? String(req.body.taxProfileId) : null;
        if (taxProfileId) await findProfile(db, companyId, taxProfileId);
        const [found] = await db.query('SELECT id FROM products WHERE id IN (?)', [ids]);
        if (found.length !== ids.length) throw problem('Algum produto não foi encontrado.', 404);
        targets = ids.map(id => [id, taxProfileId]);
      } else {
        const [products] = await db.query('SELECT id,ncm FROM products WHERE COALESCE(is_parent,0)=0');
        for (const product of products) {
          if (existing.get(String(product.id))) continue;
          const suggestion = core.suggestProfile(profiles, product.ncm);
          if (suggestion) targets.push([String(product.id), suggestion.id]);
        }
      }
      for (const [productId, taxProfileId] of targets) {
        if (existing.has(productId)) {
          if (existing.get(productId) === taxProfileId) continue;
          await db.query('UPDATE product_fiscal_settings SET tax_profile_id=?,version=version+1,updated_by=? WHERE company_profile_id=? AND product_id=?', [taxProfileId, req.accountantActor, companyId, productId]);
        } else await db.query('INSERT INTO product_fiscal_settings (company_profile_id,product_id,tax_profile_id,overrides_json,updated_by) VALUES (?,?,?,?,?)', [companyId, productId, taxProfileId, '{}', req.accountantActor]);
        changed++;
      }
      await event(db, req, 'product_fiscal_settings_assign', { mode, changed, taxProfileId: mode === 'explicit' ? (req.body?.taxProfileId || null) : 'suggested' });
      await db.commit();
    } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
    return { changed, mode };
  });
}

module.exports = { registerFiscalTaxProfileRoutes };
