const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerProductStorefrontOfferRoutes } = require('../services/productStorefrontOffersServer.cjs');

test('cotação 3D usa preço do servidor e exige consulta para quantidade acima do estoque', async () => {
  const app = Fastify();
  const calls = [];
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ id: 'p1', sku: 'SKU-1', name: 'Peça', title: 'Peça 3D',
        price_retail: 6500, price_promo: 5900, stock_quantity: 10,
        location_count: 1, location_available: 2,
        print3d_preorder_enabled: 1, print3d_preorder_limit: 5, production_days: 3 }]];
    } }, requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'POST', url: '/storefronts/loja_3d/quote',
    payload: { items: [{ product_id: 'p1', quantity: 4, unit_price: 1 }] } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().subtotal, null);
  assert.equal(response.json().payment_schedule, null);
  assert.deepEqual([response.json().items[0].ready_quantity, response.json().items[0].preorder_quantity], [2, 2]);
  assert.equal(response.json().items[0].production_days, 3);
  assert.equal(response.json().items[0].status, 'requires_consultation');
  assert.equal(response.json().can_checkout, false);
  assert.match(calls[0].sql, /o\.storefront = 'loja_3d'/);
  assert.match(calls[0].sql, /psl\.quantity - psl\.reserved_quantity/);
  assert.deepEqual(calls[0].params, ['p1']);
  await app.close();
});

test('cotação rejeita item duplicado e não expõe preço de oferta oculta', async () => {
  const app = Fastify();
  let calls = 0;
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async () => { calls++; return [[]]; } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const duplicate = await app.inject({ method: 'POST', url: '/storefronts/loja_3d/quote',
    payload: { items: [{ product_id: 'p1', quantity: 1 }, { product_id: 'p1', quantity: 2 }] } });
  assert.equal(duplicate.statusCode, 400);
  assert.equal(calls, 0);
  const unavailable = await app.inject({ method: 'POST', url: '/storefronts/loja_3d/quote',
    payload: { items: [{ product_id: 'p1', quantity: 1 }] } });
  assert.equal(unavailable.json().subtotal, null);
  assert.equal(unavailable.json().payment_schedule, null);
  assert.equal(unavailable.json().items[0].status, 'unavailable');
  assert.equal(Object.hasOwn(unavailable.json().items[0], 'unit_price'), false);
  await app.close();
});

test('API pública entrega somente a projeção comercial do site, sem custo', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ id: 'p1', sku: 'SKU-1', name: 'Nome central', title: 'Nome 3D', status: 'active',
        is_parent: 0, is_print3d: 1, publication_status: 'published', storefront: 'loja_3d',
        price_retail: 6500, price_cost: 1200, stock_quantity: 2, available_stock: 1, images: '["foto.webp"]',
        specs: '{"material":"PLA"}', custom_fields: '{}' }]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/loja_3d/products' });
  assert.equal(response.statusCode, 200);
  const [product] = response.json();
  assert.equal(product.name, 'Nome 3D');
  assert.equal(product.price_retail, 6500);
  assert.equal(product.stock_quantity, 2);
  assert.equal(product.available_stock, 1);
  assert.equal(product.storefront, 'loja_3d');
  assert.deepEqual(product.images, ['foto.webp']);
  assert.equal(Object.hasOwn(product, 'price_cost'), false);
  assert.match(calls[0].sql, /o\.publication_status = 'published'/);
  assert.match(calls[0].sql, /p\.is_print3d = 1/);
  assert.match(calls[0].sql, /psl\.quantity - psl\.reserved_quantity/);
  await app.close();
});

test('enriquecimento de fotos do catálogo mantém o preço da oferta do site', async () => {
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async () => [[{ id: 'p1', product_id: 'p1', sku: 'SKU-1', name: 'Produto',
      status: 'active', is_parent: 0, storefront: 'mercado_do_vale', publication_status: 'published',
      price_retail: 5000, legacy_price_retail: 6500, images: '[]' }]] },
    requireSyncKeyOrAdmin: async () => undefined,
    enrichProducts: async (products) => products.map((product) => ({ ...product, resolved_images: ['foto-modelo.webp'] })),
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json()[0].price_retail, 5000);
  assert.deepEqual(response.json()[0].resolved_images, ['foto-modelo.webp']);
  await app.close();
});

test('API de gravação rejeita preço inválido antes de tocar no banco', async () => {
  let touched = false;
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async () => { touched = true; return [[]]; } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'PUT', url: '/admin/products/p1/storefront-offers/loja_3d',
    payload: { publication_status: 'published', price_retail: 0 } });
  assert.equal(response.statusCode, 400);
  assert.equal(touched, false);
  await app.close();
});

test('oferta MDV não pode ser publicada antes da migração de site, checkout e bot', async () => {
  let touched = false;
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async () => { touched = true; return [[]]; } },
    requireSyncKeyOrAdmin: async () => undefined,
    mdvReady: false,
  });
  const response = await app.inject({ method: 'PUT', url: '/admin/products/p1/storefront-offers/mercado_do_vale',
    payload: { publication_status: 'published', category_label: 'Acessórios', price_retail: 5000 } });
  assert.equal(response.statusCode, 409);
  assert.equal(touched, false);
  await app.close();
});

test('oferta MDV pode ser publicada após liberar a migração completa', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      return sql.startsWith('SELECT id, is_print3d')
        ? [[{ id: 'p1', is_print3d: 0, status: 'active', is_parent: 0 }]]
        : [[]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
    mdvReady: true,
  });
  const response = await app.inject({ method: 'PUT', url: '/admin/products/p1/storefront-offers/mercado_do_vale',
    payload: { publication_status: 'published', category_label: 'Acessórios', price_retail: 5000 } });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /INSERT INTO product_storefront_offers/);
  await app.close();
});

test('consulta do Mercado do Vale usa somente sua oferta, mesmo SKU com preço diferente na loja 3D', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      const storefront = params[0];
      return [[{
        id: 'p1', product_id: 'p1', sku: 'SKU-1', name: 'Produto central', status: 'active', is_parent: 0, is_print3d: 1,
        publication_status: 'published', storefront, stock_quantity: 2,
        price_retail: storefront === 'mercado_do_vale' ? 5000 : 6500,
      }]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const mdv = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products' });
  const store3d = await app.inject({ method: 'GET', url: '/storefronts/loja_3d/products' });
  assert.equal(mdv.json()[0].price_retail, 5000);
  assert.equal(store3d.json()[0].price_retail, 6500);
  assert.equal(mdv.json()[0].sku, store3d.json()[0].sku);
  assert.equal(calls[0].params[0], 'mercado_do_vale');
  assert.equal(calls[1].params[0], 'loja_3d');
  assert.equal(mdv.headers['cache-control'], 'no-store');
  assert.match(calls[0].sql, /o\.publication_status = 'published' AND o\.price_retail > 0/);
  assert.match(calls[0].sql, /o\.storefront = \?/);
  assert.match(calls[0].sql, /o\.product_id IS NULL/);
  assert.match(calls[0].sql, /COALESCE\(p\.is_print3d, 0\) = 0/);
  assert.match(calls[0].sql, /COALESCE\(p\.hide_from_catalog, 0\) = 0/);
  await app.close();
});

test('consulta do bot filtra categoria e preserva características do modelo sem cache de preço', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ id: 'p1', product_id: 'p1', sku: 'SKU-1', name: 'Celular', status: 'active', is_parent: 0,
        storefront: 'mercado_do_vale', publication_status: 'published', price_retail: 5000,
        model_template_values: '{"nfc":"Sim"}' }]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products?category=celulares&include_model_specs=true' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.json()[0].model_template_values.nfc, 'Sim');
  assert.deepEqual(calls[0].params.slice(0, 2), ['mercado_do_vale', 'celulares']);
  assert.match(calls[0].sql, /p\.category_id = \?/);
  assert.match(calls[0].sql, /m\.template_values/);
  await app.close();
});

test('consulta por SKU e categoria_id preserva os filtros do pós-lista do bot', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products?category_id=celulares&sku=SKU-1&status=active&compact=true' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0].params.slice(0, 3), ['mercado_do_vale', 'celulares', 'SKU-1']);
  assert.match(calls[0].sql, /p\.sku = \?/);
  assert.match(calls[0].sql, /JSON_ARRAY\(JSON_UNQUOTE\(JSON_EXTRACT\(p\.images/);
  assert.match(calls[0].sql, /p\.image_url LIKE 'http%'/);
  await app.close();
});

test('busca textual do bot mantém pesquisa em EAN, marca e características', async () => {
  const calls = [];
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql, params) => { calls.push({ sql, params }); return [[]]; } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products?search=azul' });
  assert.equal(response.statusCode, 200);
  assert.match(calls[0].sql, /p\.ean LIKE \?/);
  assert.match(calls[0].sql, /CAST\(p\.specs AS CHAR\) LIKE \?/);
  assert.match(calls[0].sql, /ORDER BY p\.name ASC/);
  assert.equal(calls[0].params.filter((value) => value === '%azul%').length, 10);
  await app.close();
});

test('Mercado do Vale preserva produto legado sem oferta; loja 3D exige publicação própria', async () => {
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async (sql) => {
      if (sql.includes("p.is_print3d = 1")) return [[]];
      return [[{ id: 'legacy', sku: 'LEGACY', name: 'Produto legado', status: 'active', is_parent: 0,
        stock_quantity: 3, product_id: null, legacy_price_retail: 3990, legacy_price_promo: null }]];
    } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const mdv = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products' });
  const store3d = await app.inject({ method: 'GET', url: '/storefronts/loja_3d/products' });
  assert.equal(mdv.json()[0].price_retail, 3990);
  assert.equal(store3d.json().length, 0);
  await app.close();
});

test('sem a migration, a consulta por site falha explicitamente sem cair no preço de outro canal', async () => {
  const app = Fastify();
  registerProductStorefrontOfferRoutes(app, {
    pool: { query: async () => { const error = new Error('missing table'); error.code = 'ER_NO_SUCH_TABLE'; throw error; } },
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response = await app.inject({ method: 'GET', url: '/storefronts/mercado_do_vale/products' });
  assert.equal(response.statusCode, 503);
  assert.match(response.json().error, /não foram ativadas/);
  await app.close();
});

test('cotação real da loja 3D lê specs do catálogo e expõe apenas a variante comercial', async () => {
  const app = Fastify();
  let sql;
  registerProductStorefrontOfferRoutes(app, {
    pool: {query: async statement => {
      sql=statement;
      return [[{id:'p1',name:'Peça',sku:'SKU-PETG',specs:JSON.stringify({material:'PETG',cor:'Azul',tamanho:'G',acabamento:'Fosco',imei1:'private',internal_note:'private'}),
        price_retail:2500,stock_quantity:2,location_count:0,print3d_preorder_enabled:1,production_days:4}]];
    }},
    requireSyncKeyOrAdmin: async () => undefined,
  });
  const response=await app.inject({method:'POST',url:'/storefronts/loja_3d/quote',payload:{items:[{product_id:'p1',quantity:1}]}});
  assert.equal(response.statusCode,200,response.body);
  assert.match(sql,/p\.specs/);
  assert.deepEqual(response.json().items[0].variant_snapshot,{material:'PETG',color:'Azul',size:'G',finish:'Fosco'});
  assert.doesNotMatch(response.body,/private|imei1|internal_note/);
  await app.close();
});

test('API não publica em nenhum site sem categoria escolhida', async () => {
  for (const storefront of ['mercado_do_vale', 'loja_3d']) {
    let touched = false;
    const app = Fastify();
    registerProductStorefrontOfferRoutes(app, {
      pool: { query: async () => { touched = true; return [[]]; } },
      requireSyncKeyOrAdmin: async () => undefined,
      mdvReady: true,
    });
    const response = await app.inject({ method: 'PUT', url: `/admin/products/p1/storefront-offers/${storefront}`,
      payload: { publication_status: 'published', price_retail: 5000 } });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /categoria deste site/);
    assert.equal(touched, false);
    await app.close();
  }
});
