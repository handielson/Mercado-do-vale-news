'use strict';

function registerCatalogTitleRoutes(fastify, { pool, requireSyncKeyOrAdmin }) {
    fastify.patch('/products/:id/catalog-title', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
        const value = req.body?.complement;
        if (typeof value !== 'string' || Array.from(value.trim()).length > 120) {
            return reply.code(400).send({ error: 'Informe um complemento de até 120 caracteres.' });
        }
        const complement = value.trim();
        const [result] = await pool.query(
            `UPDATE products SET catalog_title_complement=?, updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND is_parent=1 AND (parent_id IS NULL OR parent_id='')`,
            [complement || null, req.params.id],
        );
        if (!result.affectedRows) return reply.code(409).send({ error: 'Edite o complemento no produto pai da família.' });
        return { ok: true, catalog_title_complement: complement || null };
    });
}

module.exports = { registerCatalogTitleRoutes };
