'use strict';

function categorySlug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function resolveLegacyCategory(rawUri, categories) {
  const url = new URL(rawUri, 'https://www.mercadodovale.com.br');
  // Old WooCommerce pagination has different grouping and page sizes. Link
  // to the equivalent category's first page rather than guessing a page.
  const match = url.pathname.match(/^\/categoria-produtos\/(.+?)(?:\/page\/\d+)?\/?$/);
  if (!match) return null;
  const segments = match[1].split('/').map(segment => categorySlug(decodeURIComponent(segment)));
  const leaf = segments.at(-1);
  const matches = categories.filter(category => categorySlug(category.slug || category.name) === leaf);
  const byId = new Map(categories.map(category => [category.id, category]));
  const candidates = matches.filter(category => {
    if (segments.length === 1) return true;
    let parent = byId.get(category.parent_id);
    for (let index = segments.length - 2; index >= 0; index--) {
      if (!parent || categorySlug(parent.slug || parent.name) !== segments[index]) return false;
      parent = byId.get(parent.parent_id);
    }
    return true;
  });
  if (candidates.length !== 1) return null;
  return '/produtos?categoria=' + encodeURIComponent(candidates[0].id);
}

function registerLegacyCatalogSeo(fastify, { pool }) {
  fastify.get('/api/seo-legacy-category', async (request, reply) => {
    try {
      const [categories] = await pool.query('SELECT id, parent_id, name, slug FROM categories');
      const target = await resolveLegacyCategory(String(request.headers['x-original-uri'] || ''), categories);
      reply.header('Cache-Control', 'no-store');
      if (target) return reply.code(301).header('Location', 'https://www.mercadodovale.com.br' + target).send();
      return reply.code(410).type('text/html; charset=utf-8').send(
        '<!DOCTYPE html><html lang="pt-BR"><head><meta name="robots" content="noindex, follow"><title>Categoria indisponível</title></head><body><h1>Categoria indisponível</h1><a href="/produtos">Ver produtos atuais</a></body></html>');
    } catch (error) {
      request.log.error(error);
      return reply.code(503).header('Retry-After', '60').send({ error: 'Consulta de categoria temporariamente indisponível.' });
    }
  });
}
module.exports = { categorySlug, resolveLegacyCategory, registerLegacyCatalogSeo };
