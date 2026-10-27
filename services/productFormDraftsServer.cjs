'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const PREFIX = 'product.form-draft.v1.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
function draftFileReferences(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (value.__productDraftFile) { result.push(value); return result; }
  for (const item of Object.values(value)) draftFileReferences(item, result);
  return result;
}
function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.data || typeof snapshot.data !== 'object' || Array.isArray(snapshot.data)) throw Object.assign(Error('Rascunho inválido.'), { statusCode: 400 });
  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_SNAPSHOT_BYTES) throw Object.assign(Error('Rascunho muito grande. Envie as fotos antes de salvar.'), { statusCode: 413 });
  if (!Array.isArray(snapshot.familyRows) || !Array.isArray(snapshot.serialList) || !snapshot.productionSetups || typeof snapshot.productionSetups !== 'object' || !['basic','specs','media','channels','commercial','files','production','fiscal','variations'].includes(snapshot.activeSection)) throw Object.assign(Error('Estado do formulário inválido.'), { statusCode: 400 });
  for (const file of draftFileReferences(snapshot)) if (!UUID.test(file.__productDraftFile) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES || typeof file.name !== 'string') throw Object.assign(Error('Referência de arquivo inválida.'), { statusCode: 400 });
}
function registerProductFormDraftRoutes(app, { pool, requireAdminBearerToken, filesRoot = path.resolve(process.cwd(), 'private', 'product-form-drafts') }) {
  const admin = async (req, reply) => { reply.header('Cache-Control', 'no-store'); return requireAdminBearerToken(req, reply); };
  const options = { preHandler: admin };
  const key = id => { if (!UUID.test(id || '')) throw Object.assign(Error('Identificador inválido.'), { statusCode: 400 }); return PREFIX + id.toLowerCase(); };
  const filePath = (id, fileId) => { key(id); key(fileId); return path.join(filesRoot, id.toLowerCase(), fileId.toLowerCase()); };
  const read = async (id, seen = new Set()) => {
    if (seen.has(id)) throw Object.assign(Error('Vínculo circular de rascunhos.'), { statusCode: 409 });
    seen.add(id);
    const [rows] = await pool.query('SELECT value_json FROM admin_preferences WHERE preference_key=? LIMIT 1', [key(id)]);
    if (!rows[0]) throw Object.assign(Error('Rascunho não encontrado.'), { statusCode: 404 });
    const record = parse(rows[0].value_json);
    return record.superseded_by ? read(record.superseded_by, seen) : record;
  };
  const modelDrafts = async (db, modelId) => {
    const [rows] = await db.query("SELECT value_json FROM admin_preferences WHERE preference_key LIKE ? AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status'))='pending' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.snapshot.data.model_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.snapshot.data.is_parent')) IN ('true','1') ORDER BY updated_at DESC", [PREFIX + '%', modelId]);
    return rows.map(row => parse(row.value_json));
  };
  // The model lock serializes every family-draft creation/binding. Drafts remain
  // in their original storage; the canonical marker is routing metadata only.
  app.post('/admin/product-form-drafts/family/:modelId', options, async req => {
    const modelId = req.params.modelId; key(modelId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[model]] = await connection.query('SELECT m.id,m.name,m.category_id,b.name AS brand_name FROM models m LEFT JOIN brands b ON b.id=m.brand_id WHERE m.id=? FOR UPDATE', [modelId]);
      if (!model) throw Object.assign(Error('Modelo não encontrado.'), { statusCode: 404 });
      const drafts = await modelDrafts(connection, modelId);
      const canonical = drafts.filter(draft => draft.canonical_model_id === modelId);
      if (canonical.length > 1) throw Object.assign(Error('Mais de um rascunho principal para este modelo. Confira os vínculos.'), { statusCode: 409 });
      let draft = canonical[0] || (drafts.length === 1 ? drafts[0] : null);
      if (req.body?.sourceDraftId) {
        draft = drafts.find(item => item.id === req.body.sourceDraftId);
        if (!draft || draft.revision !== req.body.expectedRevision) throw Object.assign(Error('O rascunho mudou. Confira novamente antes de definir a fonte única.'), { statusCode: 409 });
        if (canonical[0] && canonical[0].id !== draft.id) throw Object.assign(Error('O modelo já tem um rascunho principal. Não é permitido trocar silenciosamente.'), { statusCode: 409 });
      }
      if (!draft && drafts.length) throw Object.assign(Error('Este modelo possui rascunhos antigos duplicados. É necessário conferir e definir o cadastro principal antes de continuar.'), { statusCode: 409 });
      const parentId = req.body?.parentId;
      if (parentId) {
        key(parentId);
        const [[parent]] = await connection.query('SELECT id,model_id,is_parent FROM products WHERE id=?', [parentId]);
        if (!parent || Number(parent.is_parent) !== 1 || (parent.model_id && parent.model_id !== modelId)) throw Object.assign(Error('O pai informado não pertence a este modelo.'), { statusCode: 409 });
        if (!draft) { await connection.commit(); return { parentId }; }
        if (draft.snapshot.data.id !== parentId && draft.snapshot.familyCheckpoint?.parent?.id !== parentId) throw Object.assign(Error('Há um pai salvo e um rascunho antigo sem vínculo. Confira os dados antes de consolidar.'), { statusCode: 409 });
      }
      const now = new Date().toISOString();
      if (!draft) {
        const { buildModelParentPrefill } = await import('./modelParentPrefill.mjs');
        const data = buildModelParentPrefill(model, model.brand_name);
        draft = { id: crypto.randomUUID(), revision: 1, title: data.name, status: 'pending', created_at: now, updated_at: now, canonical_model_id: modelId,
          snapshot: { schemaVersion:1, data, activeSection:'variations', activeSalesChannel:'mercado-livre', familyRows:[], productionSetups:{}, productionRowKey:'', serialList:[], useCustomImages:false, nameManuallyEdited:false, familyCheckpoint:{parent:null,children:{}} } };
        await connection.query('INSERT INTO admin_preferences (preference_key,value_json) VALUES (?,?)', [key(draft.id), JSON.stringify(draft)]);
      } else if (draft.canonical_model_id !== modelId) {
        draft = { ...draft, canonical_model_id:modelId, revision:draft.revision+1, updated_at:now };
        await connection.query('UPDATE admin_preferences SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE preference_key=?', [JSON.stringify(draft), key(draft.id)]);
      }
      // Historical snapshots are retained in full. Old links resolve to the one
      // active record; stale tabs cannot replace it through another draft UUID.
      for (const previous of drafts.filter(item => item.id !== draft.id)) {
        const archived = { ...previous, status:'archived', superseded_by:draft.id, revision:previous.revision+1, updated_at:now };
        await connection.query('UPDATE admin_preferences SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE preference_key=?', [JSON.stringify(archived), key(previous.id)]);
      }
      await connection.commit(); return { draftId:draft.id };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  });
  app.get('/admin/product-form-drafts', options, async () => {
    // Keep the lightweight JSON projections serialized: mysql2 otherwise decodes
    // JSON-typed columns itself and parsing a plain UUID/title again throws.
    const [rows] = await pool.query(`SELECT
      CAST(JSON_EXTRACT(value_json,'$.id') AS CHAR) AS id,
      CAST(JSON_EXTRACT(value_json,'$.revision') AS CHAR) AS revision,
      CAST(JSON_EXTRACT(value_json,'$.title') AS CHAR) AS title,
      CAST(JSON_EXTRACT(value_json,'$.status') AS CHAR) AS status,
      CAST(JSON_EXTRACT(value_json,'$.updated_at') AS CHAR) AS updated_at,
      CAST(JSON_EXTRACT(value_json,'$.created_at') AS CHAR) AS created_at,
      CAST(JSON_EXTRACT(value_json,'$.snapshot.data.is_print3d') AS CHAR) AS is_print3d,
      CAST(JSON_EXTRACT(value_json,'$.snapshot.data.is_parent') AS CHAR) AS is_parent
      FROM admin_preferences WHERE preference_key LIKE ?
      AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status'))='pending'
      ORDER BY updated_at DESC`, [PREFIX + '%']);
    return { drafts: rows.map(row => Object.fromEntries(Object.entries(row).map(([field, value]) => [field, typeof value === 'string' ? parse(value) : value]))) };
  });
  app.get('/admin/product-form-drafts/:id', options, req => read(req.params.id));
  app.get('/admin/product-form-drafts/templates/:productId', options, async req => {
    key(req.params.productId);
    const [rows] = await pool.query("SELECT value_json FROM admin_preferences WHERE preference_key LIKE ? AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.status'))='completed' AND JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.savedProductId'))=? ORDER BY JSON_UNQUOTE(JSON_EXTRACT(value_json,'$.updated_at')) DESC, updated_at DESC LIMIT 1", [PREFIX + '%', req.params.productId.toLowerCase()]);
    const draft = rows[0] ? parse(rows[0].value_json) : null;
    return { draftId: draft?.id || null, setup: draft?.snapshot?.productionSetups?.parent || null };
  });
  async function mutate(id, expectedRevision, update, familyModelId, snapshotWrite = false) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw Object.assign(Error('Revisão inválida.'), { statusCode: 400 });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (familyModelId) {
        key(familyModelId);
        await connection.query('SELECT id FROM models WHERE id=? FOR UPDATE', [familyModelId]);
        const drafts = await modelDrafts(connection, familyModelId);
        const canonical = drafts.find(draft => draft.canonical_model_id === familyModelId);
        if (canonical && canonical.id !== id) throw Object.assign(Error(`Continue no cadastro principal: /admin/products/new?draft=${canonical.id}`), { statusCode:409 });
        if (!canonical && expectedRevision === 0 && drafts.some(draft => draft.id !== id)) throw Object.assign(Error('Este modelo já tem um rascunho. Abra o cadastro único pela Gestão de Modelos.'), { statusCode:409 });
      }
      await connection.query('INSERT IGNORE INTO admin_preferences (preference_key,value_json) VALUES (?,?)', [key(id), JSON.stringify({ revision: 0 })]);
      const [rows] = await connection.query('SELECT value_json FROM admin_preferences WHERE preference_key=? FOR UPDATE', [key(id)]);
      const previous = parse(rows[0].value_json);
      if (previous.superseded_by) throw Object.assign(Error(`Este rascunho é histórico. Continue no cadastro principal: /admin/products/new?draft=${previous.superseded_by}`), { statusCode:409 });
      if (snapshotWrite && previous.canonical_model_id && previous.canonical_model_id !== familyModelId) throw Object.assign(Error('O modelo do cadastro principal não pode ser trocado ou removido.'), { statusCode:409 });
      if (previous.revision !== expectedRevision) throw Object.assign(Error('Este rascunho foi alterado em outro computador. Abra-o novamente pela lista antes de salvar.'), { statusCode: 409 });
      if (previous.status && previous.status !== 'pending') throw Object.assign(Error('Este rascunho já foi concluído ou arquivado.'), { statusCode: 409 });
      const now = new Date().toISOString();
      const next = await update(previous);
      const record = { ...next, id: id.toLowerCase(), revision: previous.revision + 1, created_at: previous.created_at || now, updated_at: now };
      await connection.query('UPDATE admin_preferences SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE preference_key=?', [JSON.stringify(record), key(id)]);
      await connection.commit(); return record;
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  app.put('/admin/product-form-drafts/:id', { ...options, bodyLimit: MAX_SNAPSHOT_BYTES + 1024 }, async req => {
    validateSnapshot(req.body?.snapshot);
    for (const file of draftFileReferences(req.body.snapshot)) {
      let stat; try { stat = await fsp.stat(filePath(req.params.id, file.__productDraftFile)); } catch { throw Object.assign(Error('Arquivo do rascunho não foi confirmado. Tente salvar novamente.'), { statusCode: 409 }); }
      if (stat.size !== file.size) throw Object.assign(Error('Tamanho do arquivo não confere.'), { statusCode: 409 });
    }
    return mutate(req.params.id, req.body.revision, previous => ({ ...previous, snapshot: req.body.snapshot, title: String(req.body.snapshot.data.name || req.body.snapshot.data.sku || 'Anúncio sem título').slice(0, 200), status: 'pending' }), req.body.snapshot.data.is_parent ? req.body.snapshot.data.model_id : undefined, true);
  });
  app.patch('/admin/product-form-drafts/:id', options, req => {
    if (!['completed', 'archived'].includes(req.body?.status)) throw Object.assign(Error('Situação inválida.'), { statusCode: 400 });
    if (req.body.savedProductId && !UUID.test(req.body.savedProductId)) throw Object.assign(Error('Produto inválido.'), { statusCode: 400 });
    return mutate(req.params.id, req.body.revision, previous => {
      if (!previous.snapshot) throw Object.assign(Error('Rascunho não encontrado.'), { statusCode: 404 });
      return { ...previous, status: req.body.status, savedProductId: req.body.savedProductId || null };
    });
  });
  app.post('/admin/product-form-drafts/:id/files/:fileId', options, async (req, reply) => {
    const destination = filePath(req.params.id, req.params.fileId);
    const part = await req.file({ limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
    if (!part || part.fieldname !== 'file') throw Object.assign(Error('Envie o arquivo no campo file.'), { statusCode: 400 });
    await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const temporary = destination + '.' + crypto.randomUUID() + '.upload';
    let size = 0;
    const hash = crypto.createHash('sha256');
    try {
      await pipeline(part.file, new Transform({ transform(chunk, encoding, callback) { size += chunk.length; hash.update(chunk); callback(size > MAX_FILE_BYTES ? Error('Arquivo maior que 500 MB.') : null, chunk); } }), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      if (!size || part.file.truncated) throw Object.assign(Error('Arquivo vazio ou maior que 500 MB.'), { statusCode: 413 });
      const digest = hash.digest('hex');
      try { await fsp.link(temporary, destination); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existingHash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(destination)) existingHash.update(chunk);
        if (existingHash.digest('hex') !== digest) throw Object.assign(Error('Identificador já associado a outro arquivo.'), { statusCode: 409 });
      }
      return { saved: true, byte_size: size, sha256: digest };
    } finally { await fsp.unlink(temporary).catch(() => {}); }
  });
  app.get('/admin/product-form-drafts/:id/files/:fileId', options, async (req, reply) => {
    const destination = filePath(req.params.id, req.params.fileId);
    const draft = await read(req.params.id);
    const reference = draftFileReferences(draft.snapshot).find(file => file.__productDraftFile === req.params.fileId);
    if (!reference) throw Object.assign(Error('Arquivo não pertence ao rascunho.'), { statusCode: 404 });
    let stat; try { stat = await fsp.stat(destination); } catch { throw Object.assign(Error('Arquivo indisponível.'), { statusCode: 404 }); }
    if (stat.size !== reference.size) throw Object.assign(Error('Arquivo incompleto.'), { statusCode: 409 });
    reply.header('Content-Type', 'application/octet-stream'); reply.header('Content-Disposition', 'attachment');
    return reply.send(fs.createReadStream(destination));
  });
}
module.exports = { registerProductFormDraftRoutes, draftFileReferences, validateSnapshot, PREFIX };
