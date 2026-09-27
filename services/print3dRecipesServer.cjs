'use strict';

const crypto = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const loadRecipeModule = () => import('../utils/print3dRecipeDraft.mjs');

function registerPrint3dRecipeRoutes(app, { pool, getBearerAuthContext, enabled = process.env.MDV_PRINT3D_RECIPES_ENABLED === '1' }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.print3dActor = String(auth.userId);
  };
  const available = (reply) => {
    if (enabled) return true;
    reply.code(503).send({ error: 'Fichas 3D ainda não habilitadas.' });
    return false;
  };
  const productId = (req, reply) => {
    const id = String(req.params?.productId || '');
    if (UUID.test(id)) return id;
    reply.code(400).send({ error: 'Identificador de produto inválido.' });
    return null;
  };
  const findRevision = async (id, revision) => {
    const [rows] = await pool.query(
      'SELECT id,product_id,sku_snapshot,revision,draft_json,draft_sha256,created_by,created_at FROM print3d_recipe_revisions WHERE product_id=? AND revision=? LIMIT 1',
      [id, revision]
    );
    return rows[0] || null;
  };

  app.get('/admin/print3d/status', { preHandler: admin }, async () => ({ enabled }));

  app.get('/admin/print3d/products/:productId/recipes', { preHandler: admin }, async (req, reply) => {
    if (!available(reply)) return;
    const id = productId(req, reply);
    if (!id) return;
    const [rows] = await pool.query(
      'SELECT id,product_id,sku_snapshot,revision,draft_sha256,created_by,created_at FROM print3d_recipe_revisions WHERE product_id=? ORDER BY created_at DESC, revision DESC LIMIT 100',
      [id]
    );
    return { recipes: rows.map(({ id: recipeId, product_id, sku_snapshot, revision, draft_sha256, created_by, created_at }) => ({
      id: recipeId, product_id, sku_snapshot, revision, draft_sha256, created_by, created_at,
    })) };
  });

  app.get('/admin/print3d/products/:productId/recipes/:revision', { preHandler: admin }, async (req, reply) => {
    if (!available(reply)) return;
    const id = productId(req, reply);
    if (!id) return;
    const revision = String(req.params.revision || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(revision)) return reply.code(400).send({ error: 'Revisão inválida.' });
    const row = await findRevision(id, revision);
    if (!row) return reply.code(404).send({ error: 'Ficha não encontrada.' });
    return { ...row, draft: typeof row.draft_json === 'string' ? JSON.parse(row.draft_json) : row.draft_json, draft_json: undefined };
  });

  app.post('/admin/print3d/products/:productId/recipes', { preHandler: admin, bodyLimit: 64 * 1024 }, async (req, reply) => {
    if (!available(reply)) return;
    const id = productId(req, reply);
    if (!id) return;
    const [products] = await pool.query('SELECT id,sku,name,is_parent FROM products WHERE id=? LIMIT 1', [id]);
    const product = products[0];
    if (!product || Number(product.is_parent) === 1) return reply.code(404).send({ error: 'Variante vendável não encontrada.' });
    let draft;
    try {
      const { validatePrint3dRecipeDraft } = await loadRecipeModule();
      draft = validatePrint3dRecipeDraft(req.body);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
    if (draft.productId !== product.id || draft.sku !== product.sku || draft.productName !== product.name) {
      return reply.code(409).send({ error: 'O produto foi alterado. Recarregue o SKU e gere novamente a ficha.' });
    }
    const serialized = JSON.stringify(draft);
    if (Buffer.byteLength(serialized, 'utf8') > 48 * 1024) return reply.code(413).send({ error: 'Ficha excede 48 KB.' });
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    const existing = await findRevision(id, draft.revision);
    if (existing) {
      if (existing.draft_sha256 !== hash) return reply.code(409).send({ error: 'Revisão já existe com conteúdo diferente. Escolha uma nova revisão.' });
      return { id: existing.id, revision: draft.revision, saved: false, sha256: hash };
    }
    const recipeId = crypto.randomUUID();
    try {
      await pool.query(
        'INSERT INTO print3d_recipe_revisions (id,product_id,sku_snapshot,revision,draft_json,draft_sha256,created_by) VALUES (?,?,?,?,?,?,?)',
        [recipeId, id, draft.sku, draft.revision, serialized, hash, req.print3dActor]
      );
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const concurrent = await findRevision(id, draft.revision);
      if (concurrent?.draft_sha256 === hash) return { id: concurrent.id, revision: draft.revision, saved: false, sha256: hash };
      return reply.code(409).send({ error: 'Revisão já existe com conteúdo diferente. Escolha uma nova revisão.' });
    }
    return reply.code(201).send({ id: recipeId, revision: draft.revision, saved: true, sha256: hash });
  });
}

module.exports = { registerPrint3dRecipeRoutes };
