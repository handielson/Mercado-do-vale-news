'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { resolveStorefrontDescription } = require('./productStorefrontOffer.cjs');

const PRODUCT_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const productPath = new RegExp(`^/products/(${PRODUCT_ID})$`, 'i');
const storefrontOfferPath = new RegExp(`^/admin/products/(${PRODUCT_ID})/storefront-offers/(mercado_do_vale|loja_3d)$`, 'i');
const storefrontOffersPath = new RegExp(`^/admin/products/(${PRODUCT_ID})/storefront-offers$`, 'i');
const storefrontProductPath = new RegExp(`^/storefronts/loja_3d/products/(${PRODUCT_ID})$`, 'i');
const previewApprovalPath = new RegExp(`^/admin/local-preview/drafts/(${PRODUCT_ID})/approve$`, 'i');
const productIdPattern = new RegExp(`^${PRODUCT_ID}$`, 'i');
const LOCAL_PRODUCT_FIELDS = new Set([
  'company_id', 'model_id', 'parent_id', 'is_parent', 'brand', 'category_id', 'name', 'sku', 'description', 'ean',
  'alternative_eans', 'specs', 'custom_fields', 'price_cost', 'price_retail', 'price_reseller', 'price_wholesale',
  'images', 'image_url', 'ncm', 'cest', 'origin', 'weight_kg', 'dimensions', 'stock_quantity', 'status',
  'track_inventory', 'is_gift', 'is_virtual', 'warranty_type', 'warranty_template_id', 'price_promo', 'promo_start',
  'promo_end', 'bling_id', 'bling_parent_id', 'shopee_item_id', 'video_url', 'marketing_background_url',
  'marketing_background_no_price_url', 'marketing_video_url', 'slug', 'exclude_from_seo', 'hide_from_catalog',
  'meta_title', 'meta_description', 'keywords', 'kits', 'production_days', 'is_print3d',
  'print3d_preorder_enabled', 'print3d_preorder_limit',
]);
const LOCAL_OFFER_FIELDS = new Set([
  'storefront', 'publication_status', 'title', 'description', 'category_label', 'slug', 'price_retail',
  'price_reseller', 'price_wholesale', 'price_promo', 'meta_title', 'meta_description',
]);

function normalizePath(raw) {
  const url = new URL(raw || '/', 'http://localhost');
  return { pathname: url.pathname, search: url.search, searchParams: url.searchParams };
}

function isLocalCatalogPreviewPath(rawPath, method = 'GET') {
  const { pathname } = normalizePath(rawPath);
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (pathname === '/products/batch' && normalizedMethod === 'POST') return true;
  if (productPath.test(pathname) && ['GET', 'PUT'].includes(normalizedMethod)) return true;
  if (storefrontOffersPath.test(pathname) && normalizedMethod === 'GET') return true;
  if (storefrontOfferPath.test(pathname) && normalizedMethod === 'PUT') return true;
  if (pathname === '/storefronts/loja_3d/products' && normalizedMethod === 'GET') return true;
  if (storefrontProductPath.test(pathname) && normalizedMethod === 'GET') return true;
  if (pathname === '/admin/local-preview/drafts' && normalizedMethod === 'GET') return true;
  return previewApprovalPath.test(pathname) && normalizedMethod === 'POST';
}

function copyAllowed(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
}

function mergeProduct(base, draft) {
  if (!draft?.patch) return base;
  return { ...base, ...draft.patch, specs: { ...(base?.specs || {}), ...(draft.patch.specs || {}) } };
}

function mergeOfferList(offers, drafts, productId) {
  const byStorefront = new Map((offers || []).map(offer => [offer.storefront, offer]));
  for (const [storefront, draft] of Object.entries(drafts.offers?.[productId] || {})) {
    byStorefront.set(storefront, { ...(byStorefront.get(storefront) || { storefront, product_id: productId }), ...draft.offer });
  }
  return [...byStorefront.values()];
}

function applyDraftOffer(product, draftOffer) {
  if (!draftOffer) return product;
  const offer = draftOffer.offer || {};
  if (offer.publication_status && offer.publication_status !== 'published') return null;
  return {
    ...product,
    name: offer.title || product.name,
    slug: offer.slug || product.slug,
    price_retail: offer.price_retail ?? product.price_retail,
    price_reseller: offer.price_reseller ?? product.price_reseller,
    price_wholesale: offer.price_wholesale ?? product.price_wholesale,
    price_promo: offer.price_promo ?? product.price_promo,
    meta_title: offer.meta_title ?? product.meta_title,
    meta_description: offer.meta_description ?? product.meta_description,
    storefront_category: offer.category_label ?? product.storefront_category,
  };
}

function productIsVisibleIn3d(product) {
  return product
    && String(product.status || 'active') === 'active'
    && Number(product.is_parent || 0) !== 1
    && Boolean(Number(product.is_print3d ?? 1))
    && Number(product.price_retail || 0) > 0;
}

function createDraftStore(filePath) {
  const empty = () => ({ version: 1, products: {}, offers: {} });
  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return { ...empty(), ...parsed, products: parsed.products || {}, offers: parsed.offers || {} };
    } catch (error) {
      if (error.code === 'ENOENT') return empty();
      throw error;
    }
  }
  async function write(data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, filePath);
  }
  return { read, write };
}

function createLocalCatalogPreviewServer({
  remoteOrigin = 'https://api.xiaomipetrolina.com.br',
  syncKey = '',
  draftFile = path.resolve(process.cwd(), '.local', 'catalog-preview-drafts.json'),
  fetchImpl = globalThis.fetch,
  host = '127.0.0.1',
  port = 3101,
} = {}) {
  const store = createDraftStore(draftFile);
  const origin = new URL(remoteOrigin);

  async function readBody(req) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 1024 * 1024) throw Object.assign(new Error('Rascunho muito grande.'), { statusCode: 413 });
      chunks.push(chunk);
    }
    if (!length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw Object.assign(new Error('JSON inválido.'), { statusCode: 400 }); }
  }

  function send(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
  }

  async function remote(pathnameWithSearch, method = 'GET', body) {
    const response = await fetchImpl(new URL(pathnameWithSearch, origin), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(syncKey ? { 'x-sync-key': syncKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || response.statusText }; }
    if (!response.ok) throw Object.assign(new Error(data.error || `API central respondeu ${response.status}.`), { statusCode: response.status, payload: data });
    return data;
  }

  async function loadParent(id, drafts, parentCache) {
    if (!id) return null;
    const localParent = drafts.products?.[id];
    if (localParent?.local_only) return mergeProduct({}, localParent);
    if (!parentCache.has(id)) {
      // Produto filho nunca deve cair silenciosamente em sua prÃ³pria descriÃ§Ã£o.
      // Se o pai nÃ£o puder ser lido, a prÃ©via falha de forma visÃ­vel em vez de
      // exibir conteÃºdo incorreto.
      parentCache.set(id, remote(`/products/${encodeURIComponent(id)}`));
    }
    const base = await parentCache.get(id);
    return base ? mergeProduct(base, drafts.products?.[id]) : null;
  }

  async function buildCatalog(rows, drafts) {
    const parentCache = new Map();
    const result = [];
    const localOnlyRows = Object.entries(drafts.products || {})
      .filter(([, draft]) => draft?.local_only)
      .map(([id, draft]) => ({ id, ...(draft.patch || {}) }));
    const allRows = [...(rows || []), ...localOnlyRows.filter(local => !(rows || []).some(row => row.id === local.id))];
    for (const row of allRows) {
      let product = mergeProduct(row, drafts.products?.[row.id]);
      product = applyDraftOffer(product, drafts.offers?.[row.id]?.loja_3d);
      if (!productIsVisibleIn3d(product)) continue;
      const parent = await loadParent(product.parent_id, drafts, parentCache);
      product.description = resolveStorefrontDescription({
        ...product,
        parent_description: parent?.description,
      });
      result.push({ ...product, storefront: 'loja_3d' });
    }
    return result;
  }

  async function approve(productId) {
    if (!syncKey) throw Object.assign(new Error('A chave de sincronização local não está configurada; aprovação bloqueada.'), { statusCode: 503 });
    const drafts = await store.read();
    const productDraft = drafts.products?.[productId];
    const offerDrafts = drafts.offers?.[productId] || {};
    if (!productDraft && Object.keys(offerDrafts).length === 0) return { ok: true, approved: 0 };
    const approved = [];
    if (productDraft) {
      if (productDraft.local_only) {
        await remote('/products/batch', 'POST', [{ id: productId, ...productDraft.patch }]);
      } else {
        await remote(`/products/${encodeURIComponent(productId)}`, 'PUT', productDraft.patch);
      }
      approved.push('produto');
    }
    for (const [storefront, draft] of Object.entries(offerDrafts)) {
      await remote(`/admin/products/${encodeURIComponent(productId)}/storefront-offers/${encodeURIComponent(storefront)}`, 'PUT', draft.offer);
      approved.push(`oferta:${storefront}`);
    }
    delete drafts.products[productId];
    delete drafts.offers[productId];
    await store.write(drafts);
    return { ok: true, approved: approved.length, changes: approved };
  }

  async function handler(req, res) {
    const { pathname, search, searchParams } = normalizePath(req.url);
    const method = String(req.method || 'GET').toUpperCase();
    try {
      const productMatch = pathname.match(productPath);
      const offersMatch = pathname.match(storefrontOffersPath);
      const offerMatch = pathname.match(storefrontOfferPath);
      const catalogProductMatch = pathname.match(storefrontProductPath);
      const approvalMatch = pathname.match(previewApprovalPath);

      if (method === 'GET' && pathname === '/admin/local-preview/drafts') {
        const drafts = await store.read();
        const requestedId = searchParams.get('product_id');
        const ids = new Set([...Object.keys(drafts.products), ...Object.keys(drafts.offers)]);
        const summaries = [...ids].filter(id => !requestedId || id === requestedId).map(id => ({
          product_id: id,
          fields: Object.keys(drafts.products[id]?.patch || {}),
          storefronts: Object.keys(drafts.offers[id] || {}),
          updated_at: drafts.products[id]?.updated_at || Object.values(drafts.offers[id] || {})[0]?.updated_at || null,
        }));
        return send(res, 200, { drafts: summaries });
      }

      if (method === 'POST' && approvalMatch) {
        if (req.headers['x-sync-key'] !== syncKey) return send(res, 403, { error: 'Aprovação local não autorizada.' });
        return send(res, 200, await approve(approvalMatch[1]));
      }

      if (method === 'GET' && productMatch) {
        const drafts = await store.read();
        const localDraft = drafts.products?.[productMatch[1]];
        if (localDraft?.local_only) {
          return send(res, 200, {
            id: productMatch[1],
            created_at: localDraft.created_at,
            updated_at: localDraft.updated_at,
            ...localDraft.patch,
          });
        }
        const base = await remote(`${pathname}${search}`);
        return send(res, 200, mergeProduct(base, drafts.products?.[productMatch[1]]));
      }

      if (method === 'POST' && pathname === '/products/batch') {
        const rows = await readBody(req);
        if (!Array.isArray(rows) || rows.length === 0) {
          return send(res, 400, { error: 'Informe pelo menos um produto para a prÃ©via local.' });
        }
        const drafts = await store.read();
        const now = new Date().toISOString();
        const resolved = [];
        for (const row of rows) {
          const productId = String(row?.id || '');
          if (!productIdPattern.test(productId)) {
            return send(res, 400, { error: 'Cada produto local precisa de um ID UUID vÃ¡lido.' });
          }
          const patch = copyAllowed(row, LOCAL_PRODUCT_FIELDS);
          drafts.products[productId] = {
            patch: { ...(drafts.products[productId]?.patch || {}), ...patch },
            local_only: true,
            created_at: drafts.products[productId]?.created_at || now,
            updated_at: now,
          };
          resolved.push({ requested_id: productId, id: productId, bling_id: null, matched_existing: false });
        }
        await store.write(drafts);
        return send(res, 200, { ok: true, preview: true, upserted: rows.length, errors: [], resolved });
      }

      if (method === 'PUT' && productMatch) {
        const patch = copyAllowed(await readBody(req), LOCAL_PRODUCT_FIELDS);
        const drafts = await store.read();
        drafts.products[productMatch[1]] = {
          patch: { ...(drafts.products[productMatch[1]]?.patch || {}), ...patch },
          local_only: Boolean(drafts.products[productMatch[1]]?.local_only),
          created_at: drafts.products[productMatch[1]]?.created_at || null,
          updated_at: new Date().toISOString(),
        };
        await store.write(drafts);
        return send(res, 200, { ok: true, preview: true, product_id: productMatch[1] });
      }

      if (method === 'GET' && offersMatch) {
        const drafts = await store.read();
        const remoteOffers = await remote(`${pathname}${search}`);
        return send(res, 200, { ...remoteOffers, offers: mergeOfferList(remoteOffers.offers, drafts, offersMatch[1]) });
      }

      if (method === 'PUT' && offerMatch) {
        const offer = copyAllowed(await readBody(req), LOCAL_OFFER_FIELDS);
        const [productId, storefront] = [offerMatch[1], offerMatch[2]];
        if (offer.storefront && offer.storefront !== storefront) return send(res, 400, { error: 'Oferta informada para outra vitrine.' });
        const drafts = await store.read();
        drafts.offers[productId] = drafts.offers[productId] || {};
        drafts.offers[productId][storefront] = { offer: { ...offer, storefront }, updated_at: new Date().toISOString() };
        await store.write(drafts);
        return send(res, 200, { ok: true, preview: true, product_id: productId, ...offer, storefront });
      }

      if (method === 'GET' && (pathname === '/storefronts/loja_3d/products' || catalogProductMatch)) {
        const drafts = await store.read();
        const remoteRows = await remote(`${pathname}${search}`);
        const rows = Array.isArray(remoteRows) ? remoteRows : [remoteRows];
        const catalog = await buildCatalog(rows, drafts);
        if (catalogProductMatch) return catalog.length ? send(res, 200, catalog[0]) : send(res, 404, { error: 'Produto indisponível nesta prévia.' });
        return send(res, 200, catalog);
      }

      return send(res, 404, { error: 'Rota não disponível na prévia local.' });
    } catch (error) {
      return send(res, error.statusCode || 502, error.payload || { error: error.message || 'Falha na prévia local.' });
    }
  }

  const server = http.createServer((req, res) => {
    void handler(req, res).catch((error) => send(res, error.statusCode || 500, { error: error.message || 'Falha na prévia local.' }));
  });
  return {
    server,
    async start() {
      if (server.listening) return server;
      await new Promise((resolve, reject) => {
        const onError = error => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
      return server;
    },
    async close() {
      if (!server.listening) return;
      await new Promise(resolve => server.close(resolve));
    },
  };
}

module.exports = { createLocalCatalogPreviewServer, isLocalCatalogPreviewPath, mergeProduct, applyDraftOffer, productIsVisibleIn3d };
