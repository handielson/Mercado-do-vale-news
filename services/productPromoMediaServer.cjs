'use strict';

// promo-media-v1: mídia da promoção por versão (imagem, vídeo e o banner da home vinculado).
// Fica em uma tabela própria, por cadastro (product_id), para não mexer no PUT /products/:id
// nem nos SELECTs de produto. A Página do Produto grava a mesma mídia em todas as cores da versão.
// O banner da home é um banner normal (tabela banners); aqui só guardamos o id dele.

const URL_MAX = 1200;
const MAX_IDS = 200;

function failure(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

let schemaPromise = null;
function ensureProductPromoMediaSchema(pool) {
  schemaPromise ||= pool.query(`CREATE TABLE IF NOT EXISTS product_promo_media (
      product_id CHAR(36) NOT NULL PRIMARY KEY,
      image_url VARCHAR(${URL_MAX}) NULL,
      video_url VARCHAR(${URL_MAX}) NULL,
      banner_id VARCHAR(64) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function httpsUrl(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > URL_MAX || !/^https:\/\/\S+$/i.test(value.trim())) {
    throw failure(`${field} precisa ser um endereço HTTPS.`);
  }
  return value.trim();
}

function bannerId(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(text)) throw failure('Banner inválido.');
  return text;
}

function productIds(value) {
  const ids = [...new Set((Array.isArray(value) ? value : String(value || '').split(','))
    .map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw failure('Informe os produtos da versão.');
  if (ids.length > MAX_IDS) throw failure(`No máximo ${MAX_IDS} produtos por vez.`);
  if (ids.some((id) => !/^[A-Za-z0-9-]{1,64}$/.test(id))) throw failure('Produto inválido.');
  return ids;
}

function normalizePromoMediaInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure('Dados inválidos.');
  return {
    product_ids: productIds(body.product_ids),
    image_url: httpsUrl(body.image_url, 'A imagem da promoção'),
    video_url: httpsUrl(body.video_url, 'O vídeo da promoção'),
    banner_id: bannerId(body.banner_id),
  };
}

function presentRow(row) {
  return { image_url: row?.image_url || null, video_url: row?.video_url || null, banner_id: row?.banner_id || null, updated_at: row?.updated_at || null };
}

/** Mídia por produto: Map(product_id → { image_url, video_url, banner_id }). Usado pela campanha e consumidores. */
async function loadPromoMediaByProductIds(pool, ids) {
  const list = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!list.length) return new Map();
  await ensureProductPromoMediaSchema(pool);
  const [rows] = await pool.query(`SELECT product_id,image_url,video_url,banner_id,updated_at FROM product_promo_media
    WHERE product_id IN (${list.map(() => '?').join(',')})`, list);
  return new Map(rows.map((row) => [String(row.product_id), presentRow(row)]));
}

async function savePromoMedia(pool, input) {
  const data = normalizePromoMediaInput(input);
  await ensureProductPromoMediaSchema(pool);
  const [found] = await pool.query(`SELECT id FROM products WHERE id IN (${data.product_ids.map(() => '?').join(',')})`, data.product_ids);
  if (found.length !== data.product_ids.length) throw failure('Algum produto da versão não existe mais. Recarregue a página.', 409);
  const empty = !data.image_url && !data.video_url && !data.banner_id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const id of data.product_ids) {
      if (empty) {
        await connection.query('DELETE FROM product_promo_media WHERE product_id=?', [id]);
      } else {
        await connection.query(`INSERT INTO product_promo_media (product_id,image_url,video_url,banner_id) VALUES (?,?,?,?)
          ON DUPLICATE KEY UPDATE image_url=VALUES(image_url), video_url=VALUES(video_url), banner_id=VALUES(banner_id)`,
        [id, data.image_url, data.video_url, data.banner_id]);
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  return loadPromoMediaByProductIds(pool, data.product_ids);
}

function registerProductPromoMediaRoutes(fastify, { pool, guard }) {
  const send = async (reply, work) => {
    reply.header('Cache-Control', 'no-store');
    try { return await work(); } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Não foi possível concluir a mídia da promoção.' });
    }
  };
  fastify.get('/admin/products/promo-media', guard, (req, reply) => send(reply, async () => {
    const items = await loadPromoMediaByProductIds(pool, productIds(req.query?.ids));
    return { items: Object.fromEntries(items) };
  }));
  fastify.put('/admin/products/promo-media', guard, (req, reply) => send(reply, async () => {
    const items = await savePromoMedia(pool, req.body || {});
    return { ok: true, items: Object.fromEntries(items) };
  }));
}

module.exports = {
  ensureProductPromoMediaSchema,
  normalizePromoMediaInput,
  loadPromoMediaByProductIds,
  savePromoMedia,
  registerProductPromoMediaRoutes,
};
