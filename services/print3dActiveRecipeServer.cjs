'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRINTABLE_KINDS = new Set(['model', 'project', 'gcode']);

function registerPrint3dActiveRecipeRoutes(app, {
  pool, getBearerAuthContext, enabled = process.env.MDV_PRINT3D_RECIPES_ENABLED === '1',
}) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.print3dActor = String(auth.userId);
  };
  const check = (req, reply) => {
    if (!enabled) { reply.code(503).send({ error: 'Fichas 3D ainda não habilitadas.' }); return null; }
    const id = String(req.params?.productId || '');
    if (!UUID.test(id)) { reply.code(400).send({ error: 'Identificador de produto inválido.' }); return null; }
    return id;
  };

  app.get('/admin/print3d/products/:productId/active-recipe', { preHandler: admin }, async (req, reply) => {
    const productId = check(req, reply);
    if (!productId) return;
    const [rows] = await pool.query(
      `SELECT a.product_id,a.recipe_id,a.primary_file_id,a.selected_by,a.selected_at,
              r.revision,r.sku_snapshot,f.kind AS primary_file_kind,
              f.original_name AS primary_file_name,f.printer_profile
         FROM print3d_active_recipes a
         JOIN print3d_recipe_revisions r ON r.id=a.recipe_id
         JOIN print3d_recipe_files f ON f.id=a.primary_file_id
        WHERE a.product_id=? LIMIT 1`, [productId]
    );
    return { activeRecipe: rows[0] || null };
  });

  app.post('/admin/print3d/products/:productId/active-recipe', { preHandler: admin }, async (req, reply) => {
    const productId = check(req, reply);
    if (!productId) return;
    const recipeId = String(req.body?.recipeId || '');
    const primaryFileId = String(req.body?.primaryFileId || '');
    if (!UUID.test(recipeId) || !UUID.test(primaryFileId)) {
      return reply.code(400).send({ error: 'Informe a revisão e o arquivo principal válidos.' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // Serializa seleções concorrentes do mesmo SKU, mesmo sem linha ativa anterior.
      const [products] = await connection.query('SELECT id,sku,is_parent FROM products WHERE id=? FOR UPDATE', [productId]);
      const product = products[0];
      if (!product || Number(product.is_parent) === 1) {
        await connection.rollback();
        return reply.code(404).send({ error: 'Variante vendável não encontrada.' });
      }
      const [recipes] = await connection.query(
        'SELECT id,revision,sku_snapshot FROM print3d_recipe_revisions WHERE id=? AND product_id=? LIMIT 1', [recipeId, productId]
      );
      const recipe = recipes[0];
      if (!recipe) {
        await connection.rollback();
        return reply.code(404).send({ error: 'Revisão não pertence a este produto.' });
      }
      if (recipe.sku_snapshot !== product.sku) {
        await connection.rollback();
        return reply.code(409).send({ error: 'O SKU mudou desde a criação da ficha. Gere uma nova revisão.' });
      }
      const [files] = await connection.query(
        'SELECT id,kind,original_name,printer_profile FROM print3d_recipe_files WHERE id=? AND recipe_id=? LIMIT 1',
        [primaryFileId, recipeId]
      );
      const file = files[0];
      if (!file || !PRINTABLE_KINDS.has(file.kind) || (file.kind === 'gcode' && !file.printer_profile)) {
        await connection.rollback();
        return reply.code(409).send({ error: 'Escolha um modelo, projeto ou G-code desta revisão como arquivo principal.' });
      }
      const [summaries] = await connection.query(
        "SELECT id FROM print3d_recipe_files WHERE recipe_id=? AND kind='print-json' LIMIT 1", [recipeId]
      );
      if (!summaries[0]) {
        await connection.rollback();
        return reply.code(409).send({ error: 'Envie o JSON de material e tempo desta revisão antes de selecioná-la.' });
      }
      const [currentRows] = await connection.query(
        'SELECT recipe_id,primary_file_id FROM print3d_active_recipes WHERE product_id=? LIMIT 1', [productId]
      );
      const changed = currentRows[0]?.recipe_id !== recipeId || currentRows[0]?.primary_file_id !== primaryFileId;
      if (changed) {
        await connection.query(
          `INSERT INTO print3d_active_recipes (product_id,recipe_id,primary_file_id,selected_by)
           VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recipe_id=VALUES(recipe_id),
           primary_file_id=VALUES(primary_file_id),selected_by=VALUES(selected_by),selected_at=CURRENT_TIMESTAMP`,
          [productId, recipeId, primaryFileId, req.print3dActor]
        );
      }
      await connection.commit();
      return { changed, activeRecipe: { product_id: productId, recipe_id: recipeId, primary_file_id: primaryFileId,
        revision: recipe.revision, sku_snapshot: recipe.sku_snapshot, primary_file_kind: file.kind,
        primary_file_name: file.original_name, printer_profile: file.printer_profile } };
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original database error */ }
      throw error;
    } finally {
      connection.release();
    }
  });
}

module.exports = { registerPrint3dActiveRecipeRoutes };
