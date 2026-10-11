'use strict';
const { randomUUID } = require('node:crypto');
const { materialCatalog } = require('./print3dMaterialsServer.cjs');
const { parse, version, upsertFilament, applyStock, initialReceipt, fail } = require('./print3dFilaments.cjs');
const COST_KEY = 'print3d.cost.v1';
const costFields = ['printerWatts','energyCentsPerKwh','machineCentsPerHour','laborCentsPerHour','packagingCentsPerPiece','taxPercent','supplies'];
function mergeCosts(previous, incoming) {
  const result = { ...previous };
  for (const field of costFields) if (Object.hasOwn(incoming || {}, field)) result[field] = incoming[field];
  for (const field of costFields.filter(f => !['supplies','taxPercent'].includes(f))) {
    if (!Number.isFinite(result[field]) || result[field] < 0 || (field !== 'printerWatts' && !Number.isSafeInteger(result[field]))) fail(400, 'Tarifas inválidas. Valores monetários usam centavos inteiros.');
  }
  if (!Number.isFinite(result.taxPercent) || result.taxPercent < 0 || result.taxPercent >= 100) fail(400, 'Imposto inválido.');
  if (!Array.isArray(result.supplies) || result.supplies.length > 500 || result.supplies.some(s => !s?.id || !s.name?.trim() || !Number.isSafeInteger(s.unitCostCents) || s.unitCostCents <= 0)) fail(400, 'Insumos inválidos.');
  // General cost edits cannot replace the separately managed filament catalog.
  result.filaments = previous.filaments || [];
  return result;
}
async function readSettings(db, lock = false) {
  if (lock) await db.query('INSERT IGNORE INTO admin_preferences (preference_key,value_json) VALUES (?,?)', [COST_KEY, '{}']);
  const [rows] = await db.query(`SELECT value_json FROM admin_preferences WHERE preference_key=?${lock ? ' FOR UPDATE' : ' LIMIT 1'}`, [COST_KEY]);
  return parse(rows[0]?.value_json);
}
async function writeSettings(db, value) {
  await db.query('UPDATE admin_preferences SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE preference_key=?', [JSON.stringify(value), COST_KEY]);
}
async function references(db) {
  const [brands] = await db.query('SELECT name FROM brands WHERE active=1 ORDER BY name');
  const [colors] = await db.query('SELECT name,hex_code FROM colors WHERE active=1 ORDER BY name');
  const [materials] = await db.query('SELECT value_json FROM admin_preferences WHERE preference_key=? LIMIT 1', ['print3d.materials.v1']);
  return { brands:brands.map(b => b.name), colors:colors.map(c => c.name), color_hex:Object.fromEntries(colors.map(c => [c.name,c.hex_code || ''])), materials:materialCatalog(materials[0]?.value_json) };
}
async function transaction(pool, work) {
  const db = await pool.getConnection();
  try { await db.beginTransaction(); const result = await work(db); await db.commit(); return result; }
  catch (error) { await db.rollback(); throw error; } finally { db.release(); }
}
async function stockOnConnection(db, items, body, actorId, approving = false) {
  const filament = items.find(f => f.id === body.filament_id);
  if (!filament) fail(409, 'Escolha um filamento cadastrado.');
  await db.query('INSERT INTO print3d_filament_stock (filament_id,name_snapshot,color_snapshot,quantity_grams) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE filament_id=filament_id', [filament.id, filament.name, filament.color]);
  const [stocks] = await db.query('SELECT * FROM print3d_filament_stock WHERE filament_id=? FOR UPDATE', [filament.id]);
  const [previous] = await db.query('SELECT filament_id,movement_key,quantity_delta_grams,reason,note FROM print3d_filament_movements WHERE movement_key=? FOR UPDATE', [body.idempotency_key]);
  const result = applyStock(Number(stocks[0].quantity_grams), previous, body);
  if (filament.active === false && !approving && !result.replayed) fail(409, 'Escolha um filamento ativo cadastrado.');
  if (!result.replayed) {
    await db.query('UPDATE print3d_filament_stock SET quantity_grams=?,name_snapshot=?,color_snapshot=? WHERE filament_id=?', [result.balance, filament.name, filament.color, filament.id]);
    const input = result.input;
    await db.query('INSERT INTO print3d_filament_movements (id,filament_id,movement_key,quantity_delta_grams,reason,note,actor_id) VALUES (?,?,?,?,?,?,?)', [randomUUID(), filament.id, input.idempotency_key, input.quantity_grams, input.reason, input.note, actorId]);
  }
  return { filament_id:filament.id, quantity_grams:result.balance, replayed:result.replayed };
}
function registerPrint3dFilamentRoutes(app, { pool, getBearerAuthContext, stockEnabled = false }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control','no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error:'Sessão de administrador necessária.' });
    req.filamentActor = String(auth.userId);
  };
  const run = handler => async (req, reply) => {
    try { return await handler(req); }
    catch (error) { req.log?.error({ err:error }, 'filament-catalog'); return reply.code(error.statusCode || 500).send({ error:error.statusCode ? error.message : 'Não foi possível acessar o cadastro de filamentos.' }); }
  };
  const capabilities = async () => {
    if (!stockEnabled) return { enabled:true, stockEnabled:false, approval:true, colorModes:['single','gradient'] };
    const [columns] = await pool.query("SHOW COLUMNS FROM print3d_filament_movements LIKE 'note'");
    return { enabled:true, stockEnabled:columns.length > 0, approval:true, colorModes:['single','gradient'] };
  };
  app.get('/admin/print3d/filaments/status', { preHandler:admin }, run(capabilities));
  app.get('/admin/print3d/filaments', { preHandler:admin }, run(async () => {
    const settings = await readSettings(pool);
    return { filaments:settings.filaments || [], version:version(settings.filaments), references:await references(pool), preview:false };
  }));
  app.post('/admin/print3d/filaments', { preHandler:admin, bodyLimit:8192 }, run(req => transaction(pool, async db => {
    const settings = await readSettings(db, true);
    if (req.body?.version !== version(settings.filaments)) fail(409, 'O cadastro mudou. Atualize antes de salvar.');
    const receipt = initialReceipt(req.body.receipt, req.body.filament || {}, settings.filaments || []);
    if (receipt && !(await capabilities()).stockEnabled) fail(503, 'Entrada exige o estoque habilitado e a migração 054 aprovada. Nenhum cadastro foi salvo.');
    settings.filaments = upsertFilament(settings.filaments || [], req.body.filament || {}, await references(db));
    await writeSettings(db, settings);
    if (receipt) await stockOnConnection(db, settings.filaments, receipt, req.filamentActor);
    return { filaments:settings.filaments, version:version(settings.filaments) };
  })));
  app.get('/admin/print3d/filaments/stock', { preHandler:admin }, run(async req => {
    if (!(await capabilities()).stockEnabled) return { enabled:false, balances:[], movements:[] };
    const [balances] = await pool.query('SELECT filament_id,quantity_grams FROM print3d_filament_stock');
    const [movements] = await pool.query('SELECT id,filament_id,movement_key,quantity_delta_grams,reason,note,created_at FROM print3d_filament_movements ORDER BY created_at DESC,id DESC LIMIT 200');
    if (req.query?.movement_keys) {
      const keys = String(req.query.movement_keys).split(',');
      if (keys.length > 100 || keys.some(k => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))) fail(400, 'Identificadores de movimentos inválidos.');
      const [replays] = await pool.query(`SELECT id,filament_id,movement_key,quantity_delta_grams,reason,note,created_at FROM print3d_filament_movements WHERE movement_key IN (${keys.map(() => '?').join(',')})`, keys);
      for (const replay of replays) if (!movements.some(m => m.movement_key === replay.movement_key)) movements.push(replay);
    }
    return { enabled:true, balances:balances.map(b => ({ ...b, quantity_grams:Number(b.quantity_grams) })), movements };
  }));
  app.post('/admin/print3d/filaments/movements', { preHandler:admin, bodyLimit:8192 }, run(async req => {
    if (!(await capabilities()).stockEnabled) fail(503, 'Estoque de filamentos exige o módulo habilitado e a migração 054 aprovada.');
    return transaction(pool, async db => {
      const settings = await readSettings(db, true);
      const result = await stockOnConnection(db, settings.filaments || [], req.body, req.filamentActor);
      if (req.body.action === 'deactivate' && !result.replayed) {
        settings.filaments = settings.filaments.map(f => f.id === req.body.filament_id ? {...f,active:false} : f);
        await writeSettings(db, settings);
      }
      return result;
    });
  }));
  app.post('/admin/print3d/filaments/approve', { preHandler:admin, bodyLimit:1024 * 1024 }, run(async req => {
    const payload = req.body;
    if (!Array.isArray(payload?.movements) || payload.movements.length > 1000 || !Array.isArray(payload.filaments) || payload.filaments.length > 2000) fail(400, 'Aprovação inválida.');
    if (payload.movements.length && !(await capabilities()).stockEnabled) fail(503, 'Aprovação bloqueada: estoque/migração 054 ainda não habilitados na produção.');
    return transaction(pool, async db => {
      const settings = await readSettings(db, true);
      const current = settings.filaments || [];
      // Lost HTTP response after commit: identical catalog and movement keys can replay.
      if (payload.base_version !== version(current) && version(payload.filaments) !== version(current)) fail(409, 'O catálogo central mudou. Reconcilie os rascunhos antes de aprovar.');
      const refs = await references(db);
      let items = current;
      for (const f of payload.filaments) {
        const previous = items.find(p => p.id === f.id);
        if (previous && JSON.stringify(previous) === JSON.stringify(f)) continue; // untouched legacy preserved
        items = upsertFilament(items, f, refs);
      }
      settings.filaments = items;
      await writeSettings(db, settings);
      const movements = [];
      const deactivated = new Set();
      // Pending receipts can precede a deactivation in the same draft. Preserve
      // their order and ledger even though the approved final catalog is inactive.
      for (const body of [...payload.movements].sort((a, b) => String(a.filament_id).localeCompare(String(b.filament_id)))) {
        const result = await stockOnConnection(db, items, body, req.filamentActor, true);
        if (deactivated.has(body.filament_id) && !result.replayed) fail(409, 'Não é possível movimentar o filamento após desativá-lo no rascunho.');
        movements.push(result);
        if (body.action === 'deactivate') {
          deactivated.add(body.filament_id);
          items = items.map(f => f.id === body.filament_id ? {...f,active:false} : f);
          settings.filaments = items;
        }
      }
      await writeSettings(db, settings);
      return { approved:true, version:version(items), movements };
    });
  }));
  return { saveCosts:body => transaction(pool, async db => {
    const previous = await readSettings(db, true);
    // Reject legacy editors attempting to silently remove/rewrite managed records.
    if (version(body?.value?.filaments) !== version(previous.filaments)) fail(409, 'Filamentos são gerenciados no cadastro próprio. Atualize a tela antes de salvar tarifas.');
    const value = mergeCosts(previous, body.value);
    await writeSettings(db, value);
    return { ok:true, key:COST_KEY, value };
  }), admin };
}
module.exports = { registerPrint3dFilamentRoutes, mergeCosts, stockOnConnection };
