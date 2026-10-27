'use strict';

const SITE = 'https://www.mercadodovale.com.br';
const flag = value => value === true || value === 1 || value === '1';
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const text = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const money = value => (Number(value) / 100).toFixed(2) + ' BRL';

function publicImage(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function buildMetaCatalogFeed(products, settings, now = new Date()) {
  if (!settings || !flag(settings.enable_public_catalog) || flag(settings.require_login) || !flag(settings.show_prices)) {
    throw new Error('O catálogo público com preços precisa estar habilitado.');
  }
  const items = [];
  for (const product of products) {
    const price = Number(product.price_retail);
    const stock = Number(product.stock_quantity || 0);
    const tracked = product.track_inventory == null ? true : flag(product.track_inventory);
    const images = [...new Set((product.resolved_images || []).map(publicImage).filter(Boolean))];
    const title = text(product.name, 200);
    if (!product.id || !title || !Number.isSafeInteger(price) || price <= 0 || !images.length || !text(product.brand, 100)
      || flag(product.is_parent) || flag(product.hide_from_catalog) || flag(product.exclude_from_seo)
      || !['active', 'ativo'].includes(String(product.status || 'active').toLowerCase())
      || (product.offer_type && product.offer_visibility === 'hidden')) continue;
    if (tracked && ((!Number.isFinite(stock)) || (flag(settings.hide_out_of_stock) && stock <= 0)
      || stock < Number(settings.min_stock_to_show || 0))) continue;
    const specs = typeof product.specs === 'string' ? JSON.parse(product.specs) : (product.specs || {});
    const fields = {
      id: product.id,
      title,
      description: text(String(product.description || '').replace(/<[^>]*>/g, ' '), 9999) || title,
      availability: !tracked || stock > 0 ? 'in stock' : 'out of stock',
      condition: ['used', 'open_box'].includes(specs.condition) ? 'used' : specs.condition === 'refurbished' ? 'refurbished' : 'new',
      price: money(price),
      link: `${SITE}/produto/${encodeURIComponent(product.id)}`,
      image_link: images[0],
      brand: text(product.brand, 100),
      ...(product.parent_id ? { item_group_id: product.parent_id } : {}),
      ...(specs.color || specs.cor ? { color: text(specs.color || specs.cor, 200) } : {}),
    };
    const promo = Number(product.price_promo);
    const start = product.promo_start ? new Date(product.promo_start).getTime() : -Infinity;
    const end = product.promo_end ? new Date(product.promo_end).getTime() : Infinity;
    if (Number.isSafeInteger(promo) && promo > 0 && promo < price && start <= now.getTime() && end >= now.getTime()) {
      fields.sale_price = money(promo);
    }
    items.push('    <item>\n' + Object.entries(fields).map(([key, value]) => `      <g:${key}>${xml(value)}</g:${key}>`).join('\n')
      + images.slice(1, 11).map(value => `\n      <g:additional_image_link>${xml(value)}</g:additional_image_link>`).join('') + '\n    </item>');
  }
  // Never replace a live catalog with an empty result during a source/configuration failure.
  if (!items.length) throw new Error('Nenhum produto público válido para exportar.');
  return { count: items.length, body: `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Mercado do Vale</title>
    <link>${SITE}</link>
    <description>Produtos do catálogo atual do Mercado do Vale</description>
${items.join('\n')}
  </channel>
</rss>\n` };
}

function registerMetaCatalogFeed(fastify, { pool, comboStockSql, attachCatalogModelColorImages }) {
  fastify.get('/api/meta-catalog.xml', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const [[settings]] = await pool.query('SELECT enable_public_catalog, require_login, show_prices, hide_out_of_stock, min_stock_to_show FROM catalog_settings LIMIT 1');
      // Reuse the public catalog's stock calculation and model/color image resolver.
      // Select only public commercial fields; costs, serial numbers and customer data never enter the feed.
      const [rows] = await pool.query(`SELECT id, company_id, model_id, parent_id, name, description, brand, sku,
          price_retail, price_promo, promo_start, promo_end, track_inventory, specs, images, image_url, status,
          ${comboStockSql('products')} AS stock_quantity
        FROM products
        WHERE (status IN ('active', 'Ativo') OR status IS NULL)
          AND (is_parent = 0 OR is_parent IS NULL)
          AND (hide_from_catalog = 0 OR hide_from_catalog IS NULL)
          AND (exclude_from_seo = 0 OR exclude_from_seo IS NULL)
          AND (offer_type IS NULL OR offer_visibility IS NULL OR offer_visibility != 'hidden')
          AND price_retail > 0
        ORDER BY id`);
      const products = await attachCatalogModelColorImages(rows, SITE);
      const feed = buildMetaCatalogFeed(products, settings);
      return reply.type('application/xml; charset=utf-8').header('X-Catalog-Product-Count', String(feed.count)).send(feed.body);
    } catch (error) {
      request.log.error(error, 'Falha ao gerar catálogo Meta');
      return reply.code(503).header('Retry-After', '300').send({ error: 'Catálogo temporariamente indisponível. Tente novamente mais tarde.' });
    }
  });
}

module.exports = { buildMetaCatalogFeed, registerMetaCatalogFeed };
