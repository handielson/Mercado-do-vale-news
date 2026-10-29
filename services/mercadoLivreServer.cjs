const crypto = require('crypto');
const { createListingPriceHandlers } = require('./mercadoLivreListingPrice.cjs');
const { createListingStockHandlers } = require('./mercadoLivreListingStock.cjs');

const ML_API_ORIGIN = 'https://api.mercadolibre.com';
const ML_AUTH_ORIGIN = 'https://auth.mercadolivre.com.br';
const DEFAULT_REDIRECT_URL = 'https://www.mercadodovale.com.br/api/mercado-livre/oauth/callback';
let refreshPromise = null;

function listingRows(item) {
  const skuOf = source => String(source?.attributes?.find(a => a.id === 'SELLER_SKU')?.value_name || source?.seller_sku || source?.seller_custom_field || '').trim();
  const variants = Array.isArray(item.variations) && item.variations.length ? item.variations : [null];
  return variants.map(variant => ({
    itemId: String(item.id), variationId: variant ? String(variant.id) : '', title: String(item.title || ''),
    status: String(item.status || ''), sku: skuOf(variant || item),
    variation: (variant?.attribute_combinations || []).map(a => `${a.name}: ${a.value_name}`).join(' · '),
  }));
}

function suggestListingLinks(rows, products, links) {
  return rows.map(row => {
    const existing = links.filter(link => link.item_id === row.itemId && String(link.variation_id || '') === row.variationId);
    const candidates = row.sku ? products.filter(product => String(product.sku || '').trim() === row.sku && !Number(product.is_parent)) : [];
    return { ...row, existing: existing.map(link => ({ productId: link.product_id, sku: link.seller_sku })),
      candidates: candidates.map(product => ({ id: product.id, sku: product.sku, name: product.name })),
      match: existing.length ? 'linked' : !row.sku ? 'missing_sku' : candidates.length === 1 ? 'unique' : candidates.length > 1 ? 'ambiguous' : 'not_found' };
  });
}

function createListingHandlers({ pool, settings: settingsFor, request }) {
  const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
  const account = async () => {
    const settings = await settingsFor();
    if (!/^\d+$/.test(String(settings.user_id || ''))) throw fail('Conecte a conta do Mercado Livre.', 409);
    return String(settings.user_id);
  };
  const getItem = async (id, seller) => {
    const item = await request(`/items/${encodeURIComponent(id)}?include_attributes=all`);
    if (String(item.seller_id) !== seller || String(item.id) !== id) throw fail('Anúncio não pertence à conta conectada.', 409);
    return item;
  };
  return {
    async discover(req) {
      const seller = await account();
      const cursor = req.query?.cursor;
      if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 4096)) throw fail('Cursor inválido.');
      const query = new URLSearchParams({ search_type: 'scan', limit: '20' });
      if (cursor) query.set('scroll_id', cursor);
      const search = await request(`/users/${seller}/items/search?${query}`);
      const ids = search.results ?? [];
      if (!Array.isArray(ids) || ids.length > 20 || ids.some(id => !/^MLB\d+$/.test(id))) throw fail('Resposta inesperada na busca de anúncios.', 502);
      const rows = [];
      const errors = [];
      for (let offset = 0; offset < ids.length; offset += 5) {
        const batch = ids.slice(offset, offset + 5);
        const results = await Promise.allSettled(batch.map(id => getItem(id, seller)));
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') rows.push(...listingRows(result.value));
          else errors.push({ itemId: batch[index], error: 'Não foi possível consultar este anúncio. Reinicie a busca para tentar novamente.' });
        });
      }
      const skus = [...new Set(rows.map(row => row.sku).filter(Boolean))];
      const [products] = skus.length ? await pool.query(`SELECT id,sku,name,is_parent FROM products WHERE sku IN (${skus.map(() => '?').join(',')})`, skus) : [[]];
      const [links] = ids.length ? await pool.query(`SELECT product_id,item_id,variation_id,seller_sku FROM mercado_livre_products WHERE item_id IN (${ids.map(() => '?').join(',')})`, ids) : [[]];
      return { items: suggestListingLinks(rows, products, links), errors, sellerId: seller, total: Number(search.paging?.total || 0),
        nextCursor: ids.length && search.scroll_id ? String(search.scroll_id) : null };
    },
    async candidates(req) {
      const q = String(req.query?.q || '').trim();
      if (q.length < 2 || q.length > 120) throw fail('Digite de 2 a 120 caracteres para buscar o produto.');
      const [items] = await pool.query('SELECT id,sku,name FROM products WHERE COALESCE(is_parent,0)=0 AND (LOCATE(?,sku)>0 OR LOCATE(?,name)>0) ORDER BY sku,id LIMIT 25', [q, q]);
      return { items };
    },
    async link(req) {
      const body = req.body || {};
      const productId = String(body.productId || '');
      const itemId = String(body.itemId || '').trim().toUpperCase();
      const variationId = String(body.variationId || '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) || !/^MLB\d+$/.test(itemId) || !/^\d*$/.test(variationId)) throw fail('Produto, anúncio ou variação inválidos.');
      const seller = await account();
      const item = await getItem(itemId, seller);
      if (!listingRows(item).some(row => row.variationId === variationId)) throw fail('Selecione uma variação válida deste anúncio.');
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        // Serialize manual linking and prevent replacing an existing assignment.
        const [accounts] = await connection.query('SELECT user_id FROM mercado_livre_settings WHERE id=1 FOR UPDATE');
        if (String(accounts[0]?.user_id) !== seller) throw fail('Conta alterada durante a conferência. Busque os anúncios novamente.', 409);
        const [products] = await connection.query('SELECT id,sku,is_parent FROM products WHERE id=? FOR UPDATE', [productId]);
        if (!products.length || Number(products[0].is_parent)) throw fail('Selecione um produto vendável cadastrado.');
        const [links] = await connection.query('SELECT product_id FROM mercado_livre_products WHERE item_id=? AND variation_id=? FOR UPDATE', [itemId, variationId]);
        if (links.some(link => link.product_id !== productId)) throw fail('Anúncio já vinculado a outro produto. O vínculo existente foi preservado.', 409);
        if (!links.length) await connection.query('INSERT INTO mercado_livre_products (product_id,item_id,variation_id,seller_sku) VALUES (?,?,?,?)', [productId, itemId, variationId, products[0].sku]);
        await connection.commit();
        return { ok: true, alreadyLinked: links.length > 0 };
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
  };
}

function normalizeAvailableQuantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function parseNotificationResource(payload = {}) {
  const topic = String(payload.topic || '').trim();
  const resource = String(payload.resource || '').trim();
  const match = resource.match(/^\/(orders|shipments)\/(\d+)/);
  if (!match) return null;
  const kind = match[1] === 'orders' ? 'order' : 'shipment';
  if ((kind === 'order' && topic !== 'orders_v2') || (kind === 'shipment' && topic !== 'shipments')) return null;
  return { topic, resourceId: match[2], kind };
}

function classifyShipment(shipment = {}) {
  const status = String(shipment.status || '');
  const substatus = String(shipment.substatus || '');
  return {
    printable: status === 'ready_to_ship' && substatus === 'ready_to_print',
    needsDce: status === 'ready_to_ship' && substatus === 'invoice_pending',
  };
}

function isClosedShipment(status) {
  return ['shipped', 'delivered', 'cancelled', 'not_delivered'].includes(String(status || ''));
}

function presentPrintJob(job) {
  // Keep the stored audit/print steps intact; closed shipping is not a printing failure.
  return isClosedShipment(job.shipment_status) && job.status !== 'printed'
    ? { ...job, status: 'closed', last_error: null }
    : job;
}

function mercadoLivreOrderToAdminSale(order = {}) {
  const items = (Array.isArray(order.order_items) ? order.order_items : []).map((entry) => {
    const quantity = Math.max(1, Number(entry?.quantity) || 1);
    const unitPrice = Number(entry?.unit_price) || 0;
    return {
      name: String(entry?.item?.title || 'Item Mercado Livre'),
      sku: String(entry?.item?.seller_sku || entry?.item?.seller_custom_field || ''),
      variation: String(entry?.item?.variation_id || ''),
      quantity,
      unit_price_cents: Math.round(unitPrice * 100),
      total_cents: Math.round(unitPrice * quantity * 100),
      image_url: '',
    };
  });
  const buyer = order.buyer || {};
  return {
    channel: 'mercado_livre',
    external_id: String(order.id || ''),
    display_id: String(order.id || ''),
    status: String(order.status || 'confirmed'),
    customer_name: String(buyer.nickname || buyer.first_name || 'Cliente Mercado Livre'),
    total_cents: Math.round((Number(order.total_amount) || 0) * 100),
    currency: String(order.currency_id || 'BRL'),
    occurred_at: String(order.date_closed || order.date_created || new Date().toISOString()),
    details: {
      items,
      payment: 'Mercado Livre',
      shipment_id: order.shipping?.id ? String(order.shipping.id) : '',
      pack_id: order.pack_id ? String(order.pack_id) : '',
    },
  };
}

function mercadoLivrePaidOrderToMobileSale(order = {}) {
  if (String(order.status || '').toLowerCase() !== 'paid' || !order.id) return null;
  // Missing timestamps must not turn an old order into a new sale notification.
  if (!order.date_closed && !order.date_created) return null;
  if (Number.isNaN(new Date(order.date_closed || order.date_created).getTime())) return null;
  return mercadoLivreOrderToAdminSale(order);
}

async function loadMercadoLivreSales(pool, limitValue = 50, saleId = '', startDateValue = '', endDateValue = '') {
  if (saleId) {
    if (!/^\d+$/.test(String(saleId))) throw Object.assign(new Error('Pedido Mercado Livre inválido.'), { statusCode: 400 });
    const order = await (await mlRequest(pool, `/orders/${saleId}`)).json();
    return [mercadoLivreOrderToAdminSale(order)];
  }
  const settings = await loadSettings(pool);
  const sellerId = String(settings.user_id || '').trim();
  if (!/^\d+$/.test(sellerId)) throw Object.assign(new Error('Conecte a conta do Mercado Livre.'), { statusCode: 409 });

  const limit = Math.max(1, Math.min(500, Number(limitValue) || 50));
  const startDate = String(startDateValue || '').trim();
  const endDate = String(endDateValue || '').trim();
  const sales = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (sales.length < limit && offset < total) {
    const query = new URLSearchParams({
      seller: sellerId,
      sort: 'date_desc',
      limit: String(Math.min(50, limit - sales.length)),
      offset: String(offset),
    });
    if (startDate && !Number.isNaN(new Date(startDate).getTime())) {
      query.set('order.date_created.from', new Date(startDate).toISOString());
    }
    if (endDate && !Number.isNaN(new Date(endDate).getTime())) {
      query.set('order.date_created.to', new Date(endDate).toISOString());
    }
    const response = await mlRequest(pool, `/orders/search?${query.toString()}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    sales.push(...rows.map(mercadoLivreOrderToAdminSale).filter((sale) => sale.external_id));
    total = Number(payload?.paging?.total) || sales.length;
    offset += rows.length;
    if (!rows.length) break;
  }
  return sales.slice(0, limit);
}

function buildEventKey(payload = {}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    id: payload._id || payload.id || '',
    topic: payload.topic || '',
    resource: payload.resource || '',
    sent: payload.sent || '',
    userId: payload.user_id || '',
    applicationId: payload.application_id || '',
  })).digest('hex');
}

function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function selectDcePdfDocument(info = {}) {
  if (String(info.status || '').toLowerCase() !== 'completed') return null;
  for (const document of info.documents || []) {
    const status = String(document?.status || '').toLowerCase();
    const dceKey = String(document?.dce_key || '').trim();
    const hasPdf = (document?.files || []).some((file) => String(file?.format || '').toLowerCase() === 'pdf');
    if (dceKey && hasPdf && (status === 'issued' || status === 'authorized')) return { dceKey };
  }
  return null;
}

function redirectUrl() {
  return process.env.MERCADO_LIVRE_REDIRECT_URL || DEFAULT_REDIRECT_URL;
}

function registerAliases(fastify, method, url, options, handler) {
  fastify[method](url, options, handler);
  fastify[method](`/api${url}`, options, handler);
}

function matchesMercadoLivreErpReadKey(received, expected = process.env.MERCADO_LIVRE_ERP_READ_KEY || '') {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const supplied = Buffer.from(received, 'utf8');
  const configured = Buffer.from(expected, 'utf8');
  if (configured.length < 32 || configured.length > 256 || supplied.length !== configured.length) return false;
  return crypto.timingSafeEqual(supplied, configured);
}

async function requireMercadoLivreErpRead(request, reply, requireSyncKeyOrAdmin) {
  if (matchesMercadoLivreErpReadKey(request.headers['x-erp-read-key'])) return;
  return requireSyncKeyOrAdmin(request, reply, () => {});
}

function mercadoLivreOrderToErpReview(order = {}) {
  const orderId = String(order.id || '');
  const currency = String(order.currency_id || '');
  if (!/^\d{1,30}$/.test(orderId) || !/^[A-Z]{3}$/.test(currency) ||
      !Array.isArray(order.order_items) || !order.order_items.length) {
    throw Object.assign(new Error('Pedido Mercado Livre com estrutura incompleta.'), { statusCode: 502 });
  }
  const cents = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
      throw Object.assign(new Error('Valor do pedido Mercado Livre inválido.'), { statusCode: 502 });
    }
    return Math.round(amount * 100);
  };
  const optionalCents = (value, label, allowNegative = false) => {
    if (value == null || value === '') return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || Math.abs(amount) > 1_000_000_000_000 || (!allowNegative && amount < 0)) {
      throw Object.assign(new Error(`Valor de ${label} do pagamento Mercado Livre inválido.`), { statusCode: 502 });
    }
    return Math.round(amount * 100);
  };
  const paymentDate = (value, label) => {
    if (value == null || value === '') return '';
    const result = String(value);
    if (result.length > 40 || Number.isNaN(Date.parse(result))) {
      throw Object.assign(new Error(`Data de ${label} do pagamento Mercado Livre inválida.`), { statusCode: 502 });
    }
    return result;
  };
  if (order.payments != null && (!Array.isArray(order.payments) || order.payments.length > 50)) {
    throw Object.assign(new Error('Lista de pagamentos do pedido Mercado Livre inválida.'), { statusCode: 502 });
  }
  const payments = (order.payments || []).map(payment => {
    const paymentId = String(payment?.id || '');
    const paymentStatus = String(payment?.status || 'unknown');
    const paymentCurrency = String(payment?.currency_id || currency);
    if (!/^\d{1,30}$/.test(paymentId) || !/^[A-Za-z0-9_-]{1,50}$/.test(paymentStatus) ||
        !/^[A-Z]{3}$/.test(paymentCurrency)) {
      throw Object.assign(new Error('Identificação do pagamento Mercado Livre inválida.'), { statusCode: 502 });
    }
    return {
      payment_id: paymentId,
      status: paymentStatus,
      currency: paymentCurrency,
      transaction_amount_cents: optionalCents(payment.transaction_amount, 'valor da transação'),
      total_paid_amount_cents: optionalCents(payment.total_paid_amount, 'valor pago'),
      refunded_amount_cents: optionalCents(payment.transaction_amount_refunded, 'valor reembolsado'),
      marketplace_fee_cents: optionalCents(payment.marketplace_fee, 'tarifa do marketplace', true),
      shipping_cost_cents: optionalCents(payment.shipping_cost, 'custo de envio'),
      taxes_amount_cents: optionalCents(payment.taxes_amount, 'impostos'),
      date_approved: paymentDate(payment.date_approved, 'aprovação'),
      date_last_modified: paymentDate(payment.date_last_modified, 'última alteração'),
    };
  });
  const items = order.order_items.map(entry => {
    const quantity = Number(entry?.quantity);
    const itemId = String(entry?.item?.id || '');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000 ||
        !/^ML[A-Z]\d{1,30}$/.test(itemId)) {
      throw Object.assign(new Error('Item do pedido Mercado Livre inválido.'), { statusCode: 502 });
    }
    return {
      item_id: itemId,
      variation_id: entry?.item?.variation_id == null ? '' : String(entry.item.variation_id),
      title: String(entry?.item?.title || '').slice(0, 500),
      seller_sku: String(entry?.item?.seller_sku || entry?.item?.seller_custom_field || '').slice(0, 120),
      quantity,
      unit_price_cents: cents(entry?.unit_price),
    };
  });
  const createdAt = String(order.date_created || '');
  const updatedAt = String(order.date_last_updated || '');
  const closedAt = String(order.date_closed || '');
  for (const value of [createdAt, updatedAt, closedAt].filter(Boolean)) {
    if (Number.isNaN(Date.parse(value))) {
      throw Object.assign(new Error('Data do pedido Mercado Livre inválida.'), { statusCode: 502 });
    }
  }
  return {
    order_id: orderId,
    pack_id: order.pack_id == null ? '' : String(order.pack_id),
    status: String(order.status || 'unknown').slice(0, 50),
    currency,
    total_cents: cents(order.total_amount),
    date_created: createdAt,
    date_closed: closedAt,
    date_last_updated: updatedAt,
    payments,
    items,
  };
}

async function loadMercadoLivreOrdersForErp(pool, options = {}) {
  const settings = await loadSettings(pool);
  const sellerId = String(settings.user_id || '').trim();
  if (!/^\d{1,30}$/.test(sellerId)) {
    throw Object.assign(new Error('Conecte a conta do Mercado Livre.'), { statusCode: 409 });
  }
  const limit = Number(options.limit);
  const offset = Number(options.offset);
  const dateField = options.dateField == null ? 'created' : options.dateField;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isInteger(offset) || offset < 0 || offset + limit > 10000 ||
      !['created', 'updated'].includes(dateField)) {
    throw Object.assign(new Error('Paginação de pedidos inválida.'), { statusCode: 400 });
  }
  const query = new URLSearchParams({ seller: sellerId, sort: 'date_desc', limit: String(limit), offset: String(offset) });
  const dateFilter = dateField === 'updated' ? 'order.date_last_updated' : 'order.date_created';
  for (const [key, value] of [[`${dateFilter}.from`, options.startDate], [`${dateFilter}.to`, options.endDate]]) {
    if (value) query.set(key, value);
  }
  const payload = await (await mlRequest(pool, `/orders/search?${query.toString()}`)).json();
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const total = Number(payload?.paging?.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw Object.assign(new Error('Paginação do Mercado Livre inválida.'), { statusCode: 502 });
  }
  return { seller_id: sellerId, offset, limit, total,
    items: rows.map(mercadoLivreOrderToErpReview) };
}

function validErpOrderDate(value, endOfDay = false) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    // ERP date filters are calendar days in Brazil; preserve the full local day
    // when translating them to Mercado Livre's ISO 8601 search parameters.
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00` : null;
}

const ERP_CATALOG_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function parseErpCatalogJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeErpCatalogImageUrls(value) {
  const images = parseErpCatalogJson(value, []);
  if (!Array.isArray(images)) return [];
  return [...new Set(images.filter(image => typeof image === 'string' && image.length <= 2048)
    .map(image => image.trim()).filter(image => {
      try {
        const url = new URL(image);
        return url.protocol === 'https:' && !url.username && !url.password;
      } catch { return false; }
    }))].slice(0, 20);
}

async function loadMercadoLivreErpProducts(pool, options = {}) {
  const after = options.after == null ? '' : options.after;
  const limit = options.limit == null ? 50 : Number(options.limit);
  if (typeof after !== 'string' || (after && !ERP_CATALOG_UUID.test(after)) ||
      !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw Object.assign(new Error('Paginação de produtos inválida.'), { statusCode: 400 });
  }
  const normalizedAfter = after.toLowerCase();
  const cursorClause = normalizedAfter ? ' WHERE BINARY id > BINARY ?' : '';
  const args = normalizedAfter ? [normalizedAfter, limit + 1] : [limit + 1];
  // Deliberately omit stock_quantity and every stock location from the projection.
  const [rows] = await pool.query(`SELECT id,sku,name,description,brand,ean,price_retail,price_cost,
    weight_kg,dimensions,images,status,parent_id,is_parent,updated_at
    FROM products${cursorClause} ORDER BY BINARY id ASC LIMIT ?`, args);
  if (!Array.isArray(rows) || rows.length > limit + 1) {
    throw Object.assign(new Error('Resposta inesperada do catálogo de produtos.'), { statusCode: 502 });
  }
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const items = selected.map(row => {
    const id = String(row?.id || '').toLowerCase();
    if (!ERP_CATALOG_UUID.test(id)) {
      throw Object.assign(new Error('Produto inesperado no catálogo Mercado do Vale.'), { statusCode: 502 });
    }
    const normalizeCents = (value, field) => {
      if (value == null || (typeof value === 'string' && !value.trim())) {
        return { value: null, issue: `${field}_missing` };
      }
      const cents = Number(value);
      if (!Number.isFinite(cents) || cents < 0) return { value: null, issue: `${field}_invalid` };
      if (!Number.isInteger(cents)) return { value: null, issue: `${field}_fractional_cent` };
      if (!Number.isSafeInteger(cents)) return { value: null, issue: `${field}_unsafe` };
      return { value: cents, issue: '' };
    };
    const retail = normalizeCents(row.price_retail, 'price_retail');
    const cost = normalizeCents(row.price_cost, 'price_cost');
    const weight = row.weight_kg == null || row.weight_kg === '' ? null : Number(row.weight_kg);
    const dimensions = parseErpCatalogJson(row.dimensions, {});
    return {
      id,
      sku: String(row.sku || '').trim().slice(0, 120),
      name: String(row.name || '').trim().slice(0, 500),
      description: String(row.description || '').slice(0, 4000),
      brand: String(row.brand || '').trim().slice(0, 120),
      ean: String(row.ean || '').trim().slice(0, 120),
      price_retail: retail.value,
      price_cost: cost.value,
      price_issues: [retail.issue, cost.issue].filter(Boolean),
      weight_kg: Number.isFinite(weight) && weight >= 0 && weight <= 100_000 ? weight : null,
      dimensions: dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions) ? dimensions : {},
      images: normalizeErpCatalogImageUrls(row.images),
      status: String(row.status || '').slice(0, 50),
      parent_id: row.parent_id == null ? '' : String(row.parent_id).slice(0, 100),
      is_parent: row.is_parent === true || Number(row.is_parent) === 1,
      updated_at: row.updated_at == null ? '' : String(row.updated_at).slice(0, 50),
    };
  });
  const nextCursor = hasMore && selected.length ? selected[selected.length - 1].id : null;
  if (nextCursor && nextCursor <= normalizedAfter) {
    throw Object.assign(new Error('Cursor inesperado no catálogo de produtos.'), { statusCode: 502 });
  }
  return { items, after: normalizedAfter, nextCursor };
}

async function ensureMercadoLivreTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
    client_id VARCHAR(80) NULL,
    client_secret TEXT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    token_expires_at DATETIME NULL,
    user_id VARCHAR(40) NULL,
    nickname VARCHAR(255) NULL,
    auto_dce_enabled TINYINT(1) NOT NULL DEFAULT 0,
    stock_sync_enabled TINYINT(1) NOT NULL DEFAULT 0,
    connected_at DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query('INSERT IGNORE INTO mercado_livre_settings (id) VALUES (1)');
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_oauth_states (
    state_hash CHAR(64) NOT NULL PRIMARY KEY,
    code_verifier VARCHAR(128) NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ml_oauth_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [pkceColumns] = await pool.query("SHOW COLUMNS FROM mercado_livre_oauth_states LIKE 'code_verifier'");
  if (!pkceColumns.length) {
    await pool.query('ALTER TABLE mercado_livre_oauth_states ADD COLUMN code_verifier VARCHAR(128) NULL AFTER state_hash');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_webhook_events (
    event_key CHAR(64) NOT NULL PRIMARY KEY,
    topic VARCHAR(40) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    seller_id VARCHAR(40) NULL,
    payload JSON NULL,
    status ENUM('received','processed','ignored','error') NOT NULL DEFAULT 'received',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    INDEX idx_ml_events_status (status, received_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_print_jobs (
    shipment_id VARCHAR(40) NOT NULL PRIMARY KEY,
    order_id VARCHAR(40) NOT NULL,
    pack_id VARCHAR(40) NULL,
    status ENUM('awaiting_dce','ready','printing','printed','intervention') NOT NULL DEFAULT 'awaiting_dce',
    shipment_status VARCHAR(40) NULL,
    shipment_substatus VARCHAR(80) NULL,
    tracking_number VARCHAR(120) NULL,
    payload JSON NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    label_printed_at DATETIME NULL,
    declaration_printed_at DATETIME NULL,
    summary_printed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ml_print_queue (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [declarationColumns] = await pool.query("SHOW COLUMNS FROM mercado_livre_print_jobs LIKE 'declaration_printed_at'");
  if (!declarationColumns.length) {
    await pool.query('ALTER TABLE mercado_livre_print_jobs ADD COLUMN declaration_printed_at DATETIME NULL AFTER label_printed_at');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS mercado_livre_products (
    product_id CHAR(36) NOT NULL,
    item_id VARCHAR(40) NOT NULL,
    variation_id VARCHAR(40) NOT NULL DEFAULT '',
    seller_sku VARCHAR(255) NULL,
    last_synced_at DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, item_id, variation_id),
    INDEX idx_ml_product_item (item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function loadSettings(pool, connection = pool) {
  const [rows] = await connection.query('SELECT * FROM mercado_livre_settings WHERE id = 1 LIMIT 1');
  return rows?.[0] || {};
}

function safeStatus(settings = {}) {
  return {
    configured: Boolean(settings.client_id && settings.client_secret),
    connected: Boolean(settings.access_token && settings.refresh_token && settings.user_id),
    clientId: settings.client_id || '',
    userId: settings.user_id || null,
    nickname: settings.nickname || null,
    tokenExpiresAt: settings.token_expires_at || null,
    autoDceEnabled: Boolean(settings.auto_dce_enabled),
    stockSyncEnabled: Boolean(settings.stock_sync_enabled),
    connectedAt: settings.connected_at || null,
    redirectUrl: redirectUrl(),
    webhookUrl: process.env.MERCADO_LIVRE_WEBHOOK_URL || 'https://www.mercadodovale.com.br/api/mercado-livre/webhook',
  };
}

async function tokenRequest(fields) {
  const response = await fetch(`${ML_API_ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Livre OAuth ${response.status}: ${data.message || data.error || 'falhou'}`);
  return data;
}

async function persistTokens(connection, data, fallbackRefreshToken = null) {
  const expiresIn = Math.max(60, Number(data.expires_in || 21600));
  await connection.query(
    `UPDATE mercado_livre_settings SET access_token = ?, refresh_token = ?,
       token_expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND), updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [data.access_token, data.refresh_token || fallbackRefreshToken, expiresIn],
  );
}

async function refreshAccessToken(pool) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT * FROM mercado_livre_settings WHERE id = 1 FOR UPDATE');
      const settings = rows?.[0] || {};
      const expiry = settings.token_expires_at ? new Date(settings.token_expires_at).getTime() : 0;
      if (settings.access_token && expiry > Date.now() + 120000) {
        await connection.commit();
        return settings.access_token;
      }
      if (!settings.client_id || !settings.client_secret || !settings.refresh_token) throw new Error('Conta Mercado Livre nao conectada');
      const data = await tokenRequest({
        grant_type: 'refresh_token',
        client_id: settings.client_id,
        client_secret: settings.client_secret,
        refresh_token: settings.refresh_token,
      });
      await persistTokens(connection, data, settings.refresh_token);
      await connection.commit();
      return data.access_token;
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  })();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}

async function getAccessToken(pool) {
  const settings = await loadSettings(pool);
  const expiry = settings.token_expires_at ? new Date(settings.token_expires_at).getTime() : 0;
  if (settings.access_token && expiry > Date.now() + 120000) return settings.access_token;
  return refreshAccessToken(pool);
}

function isNonBlockingValidation(resource, status, body) {
  return resource === '/items/validate' && status === 400 && body?.error === 'validation_error'
    && Array.isArray(body.cause) && body.cause.length > 0 && body.cause.every(cause => cause?.type === 'warning');
}

async function mlRequest(pool, resource, options = {}, retry = true) {
  const token = await getAccessToken(pool);
  const response = await fetch(`${ML_API_ORIGIN}${resource}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  if (response.status === 401 && retry) {
    await pool.query('UPDATE mercado_livre_settings SET token_expires_at = NOW() WHERE id = 1');
    await refreshAccessToken(pool);
    return mlRequest(pool, resource, options, false);
  }
  if (!response.ok) {
    if (resource === '/items/validate' && response.status === 400) {
      const validation = await response.clone().json().catch(() => null);
      if (isNonBlockingValidation(resource, response.status, validation)) return response;
      if (validation?.error === 'validation_error') {
        const codes = Array.isArray(validation.cause) ? validation.cause.filter(cause => cause?.type === 'error').map(cause => cause.code).filter(code => typeof code === 'string' && /^[a-z0-9_.-]+$/i.test(code)) : [];
        throw Object.assign(new Error(`Mercado Livre recusou a validação${codes.length ? ': ' + codes.join(', ') : '. Revise os dados do anúncio.'}`), { statusCode: 400, remoteStatus: 400 });
      }
    }
    const body = await response.text();
    throw Object.assign(new Error(`Mercado Livre API ${response.status}: ${body.slice(0, 800)}`), { remoteStatus: response.status });
  }
  return response;
}

async function upsertPrintJob(pool, order, shipment) {
  const shipmentId = String(shipment.id || order.shipping?.id || '');
  if (!shipmentId) return null;
  const state = classifyShipment(shipment);
  const status = state.printable ? 'ready' : state.needsDce ? 'awaiting_dce' : 'intervention';
  const tracking = shipment.tracking_number || shipment.tracking_id || null;
  await pool.query(
    `INSERT INTO mercado_livre_print_jobs
      (shipment_id, order_id, pack_id, status, shipment_status, shipment_substatus, tracking_number, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE order_id=VALUES(order_id), pack_id=VALUES(pack_id),
       status=IF(status IN ('printed','printing') OR (status='intervention' AND last_error IS NOT NULL),status,VALUES(status)), shipment_status=VALUES(shipment_status),
       shipment_substatus=VALUES(shipment_substatus), tracking_number=VALUES(tracking_number),
       payload=VALUES(payload), updated_at=CURRENT_TIMESTAMP`,
    [shipmentId, String(order.id), order.pack_id ? String(order.pack_id) : null, status,
      shipment.status || null, shipment.substatus || null, tracking, JSON.stringify({ order, shipment })],
  );
  return { shipmentId, status, state };
}

async function autoLinkOrderItems(pool, order) {
  for (const orderItem of order.order_items || []) {
    const item = orderItem.item || {};
    const sku = String(item.seller_sku || item.seller_custom_field || orderItem.seller_sku || '').trim();
    const itemId = String(item.id || '').trim().toUpperCase();
    const variationId = String(item.variation_id || '').trim();
    if (!sku || !/^MLB\d+$/.test(itemId)) continue;
    const [products] = await pool.query('SELECT id FROM products WHERE sku = ? LIMIT 2', [sku]);
    if (products.length !== 1) continue;
    await pool.query(`INSERT INTO mercado_livre_products (product_id,item_id,variation_id,seller_sku) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE seller_sku=VALUES(seller_sku), updated_at=CURRENT_TIMESTAMP`,
    [products[0].id, itemId, variationId, sku]);
  }
}

async function processNotification(pool, eventKey, parsed, { onSale = async () => {} } = {}) {
  try {
    let order;
    let shipment;
    if (parsed.kind === 'order') {
      order = await (await mlRequest(pool, `/orders/${parsed.resourceId}`)).json();
      const sale = mercadoLivrePaidOrderToMobileSale(order);
      if (sale) await onSale(sale);
      const shipmentId = order.shipping?.id;
      if (!shipmentId) throw new Error('Pedido sem remessa associada');
      shipment = await (await mlRequest(pool, `/shipments/${shipmentId}`)).json();
    } else {
      shipment = await (await mlRequest(pool, `/shipments/${parsed.resourceId}`)).json();
      const orderId = shipment.order_id || shipment.order?.id;
      if (!orderId) throw new Error('Remessa sem pedido associado');
      order = await (await mlRequest(pool, `/orders/${orderId}`)).json();
      const sale = mercadoLivrePaidOrderToMobileSale(order);
      if (sale) await onSale(sale);
    }
    await autoLinkOrderItems(pool, order);
    let job = await upsertPrintJob(pool, order, shipment);
    const settings = await loadSettings(pool);
    if (job?.state.needsDce && settings.auto_dce_enabled) {
      await mlRequest(pool, `/mlb/order/${order.id}/dce/emission`, { method: 'POST', body: '{}' });
      shipment = await (await mlRequest(pool, `/shipments/${job.shipmentId}`)).json();
      job = await upsertPrintJob(pool, order, shipment);
    }
    await pool.query(
      `UPDATE mercado_livre_webhook_events SET status='processed', processed_at=NOW(), attempts=attempts+1, last_error=NULL WHERE event_key=?`,
      [eventKey],
    );
    return job;
  } catch (error) {
    await pool.query(
      `UPDATE mercado_livre_webhook_events SET status='error', attempts=attempts+1, last_error=? WHERE event_key=?`,
      [String(error.message || error).slice(0, 2000), eventKey],
    ).catch(() => {});
    throw error;
  }
}

async function syncMercadoLivreStockFromBlingTargets(pool, stockTargets = []) {
  const settings = await loadSettings(pool).catch(() => ({}));
  const result = { ok: true, enabled: Boolean(settings.stock_sync_enabled), updated: 0, skipped: 0, errors: [] };
  if (!result.enabled || !settings.access_token) return result;
  for (const target of stockTargets) {
    const productId = String(target?.product_id || target?.id || '');
    if (!productId) { result.skipped += 1; continue; }
    const [links] = await pool.query('SELECT * FROM mercado_livre_products WHERE product_id = ?', [productId]);
    if (!links.length) { result.skipped += 1; continue; }
    const availableQuantity = normalizeAvailableQuantity(target.stock_quantity ?? target.stockQty ?? target.quantity);
    for (const link of links) {
      try {
        const payload = link.variation_id
          ? { variations: [{ id: Number(link.variation_id), available_quantity: availableQuantity }] }
          : { available_quantity: availableQuantity };
        await mlRequest(pool, `/items/${encodeURIComponent(link.item_id)}`, { method: 'PUT', body: JSON.stringify(payload) });
        await pool.query('UPDATE mercado_livre_products SET last_synced_at=NOW(), last_error=NULL WHERE product_id=? AND item_id=? AND variation_id=?', [productId, link.item_id, link.variation_id]);
        result.updated += 1;
      } catch (error) {
        result.ok = false;
        const message = String(error.message || error).slice(0, 1000);
        result.errors.push({ productId, itemId: link.item_id, message });
        await pool.query('UPDATE mercado_livre_products SET last_error=? WHERE product_id=? AND item_id=? AND variation_id=?', [message, productId, link.item_id, link.variation_id]).catch(() => {});
      }
    }
  }
  return result;
}

function registerMercadoLivreRoutes(fastify, { pool, requireSyncKey, requireSyncKeyOrAdmin = requireSyncKey, onSale }) {
  const protectedRoute = { preHandler: requireSyncKeyOrAdmin };
  const erpReadRoute = { preHandler: (request, reply) =>
    requireMercadoLivreErpRead(request, reply, requireSyncKeyOrAdmin) };
  const { createPublicationHandlers } = require('./mercadoLivrePublication.cjs');
  const publication = createPublicationHandlers({ pool, settings: () => loadSettings(pool), listingRows,
    request: async (resource, options) => {
      const response = await mlRequest(pool, resource, { ...options, signal: AbortSignal.timeout(20000) });
      return response.status === 204 ? null : response.json();
    } });
  const publicationRoute = handler => async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return await handler(req); }
    catch (error) {
      return reply.code(error.statusCode || 502).send({ error: error.statusCode ? error.message : 'Mercado Livre indisponível. Se o envio já começou, confira o anúncio ou retome para concluir a descrição e o vínculo.' });
    }
  };
  registerAliases(fastify, 'get', '/mercado-livre/preparation/snapshot', protectedRoute, publicationRoute(publication.snapshot));
  registerAliases(fastify, 'post', '/mercado-livre/preparation/snapshot-jobs', protectedRoute, publicationRoute(publication.startSnapshot));
  registerAliases(fastify, 'get', '/mercado-livre/preparation/snapshot-jobs/:jobId', protectedRoute, publicationRoute(publication.snapshotStatus));
  registerAliases(fastify, 'get', '/mercado-livre/preparation/categories/:categoryId', erpReadRoute, publicationRoute(publication.category));
  registerAliases(fastify, 'post', '/mercado-livre/catalog/products/:productId/attributes', protectedRoute, publicationRoute(publication.saveCatalogAttributes));
  registerAliases(fastify, 'post', '/mercado-livre/catalog/category-discovery', protectedRoute, publicationRoute(publication.discoverCategory));
  registerAliases(fastify, 'get', '/mercado-livre/catalog/categories', protectedRoute, publicationRoute(publication.browseCategories));
  registerAliases(fastify, 'post', '/mercado-livre/preparation/preview', protectedRoute, publicationRoute(publication.preview));
  registerAliases(fastify, 'post', '/mercado-livre/preparation/pricing', protectedRoute, publicationRoute(publication.pricing));
  registerAliases(fastify, 'post', '/mercado-livre/preparation/publish', protectedRoute, publicationRoute(publication.publish));

  const getSettings = async (request) => {
    const settings = await loadSettings(pool);
    if (matchesMercadoLivreErpReadKey(request.headers['x-erp-read-key'])) {
      return {
        connected: Boolean(settings.access_token && settings.refresh_token && settings.user_id),
        userId: String(settings.user_id || ''),
        nickname: String(settings.nickname || '').slice(0, 100),
      };
    }
    return safeStatus(settings);
  };
  const patchSettings = async (request, reply) => {
    const body = request.body || {};
    const updates = [];
    const values = [];
    const mapping = { clientId: 'client_id', clientSecret: 'client_secret', autoDceEnabled: 'auto_dce_enabled', stockSyncEnabled: 'stock_sync_enabled' };
    for (const [input, column] of Object.entries(mapping)) {
      if (body[input] === undefined) continue;
      updates.push(`${column}=?`);
      values.push(input.endsWith('Enabled') ? (body[input] ? 1 : 0) : String(body[input] || '').trim());
    }
    if (!updates.length) return reply.code(400).send({ error: 'Nenhuma configuracao valida' });
    values.push(1);
    await pool.query(`UPDATE mercado_livre_settings SET ${updates.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, values);
    return safeStatus(await loadSettings(pool));
  };
  registerAliases(fastify, 'get', '/mercado-livre/settings', erpReadRoute, getSettings);
  registerAliases(fastify, 'patch', '/mercado-livre/settings', protectedRoute, patchSettings);

  const oauthAuth = async (_request, reply) => {
    const settings = await loadSettings(pool);
    if (!settings.client_id || !settings.client_secret) return reply.code(400).send({ error: 'Configure Client ID e Client Secret' });
    const state = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const pkce = createPkcePair();
    await pool.query('INSERT INTO mercado_livre_oauth_states (state_hash, code_verifier, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [hash, pkce.verifier]);
    const url = new URL(`${ML_AUTH_ORIGIN}/authorization`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', settings.client_id);
    url.searchParams.set('redirect_uri', redirectUrl());
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return { url: url.toString() };
  };
  registerAliases(fastify, 'get', '/mercado-livre/oauth/auth', protectedRoute, oauthAuth);

  const oauthCallback = async (request, reply) => {
    const code = String(request.query?.code || '');
    const state = String(request.query?.state || '');
    if (!code || !state) return reply.code(400).send('Autorizacao invalida ou expirada');
    const hash = crypto.createHash('sha256').update(state).digest('hex');
    const connection = await pool.getConnection();
    let oauthState;
    try {
      await connection.beginTransaction();
      const [states] = await connection.query(
        'SELECT code_verifier FROM mercado_livre_oauth_states WHERE state_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE', [hash],
      );
      oauthState = states?.[0];
      if (!oauthState?.code_verifier) {
        await connection.rollback();
        return reply.code(400).send('Autorizacao invalida ou expirada');
      }
      await connection.query('UPDATE mercado_livre_oauth_states SET used_at=NOW() WHERE state_hash=?', [hash]);
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
    const settings = await loadSettings(pool);
    const data = await tokenRequest({ grant_type: 'authorization_code', client_id: settings.client_id, client_secret: settings.client_secret, code, redirect_uri: redirectUrl(), code_verifier: oauthState.code_verifier });
    const profileResponse = await fetch(`${ML_API_ORIGIN}/users/me`, { headers: { authorization: `Bearer ${data.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    await persistTokens(pool, data);
    await pool.query('UPDATE mercado_livre_settings SET user_id=?, nickname=?, connected_at=NOW() WHERE id=1', [String(profile.id || data.user_id || ''), profile.nickname || null]);
    return reply.redirect('/admin/settings/mercado-livre?connected=1');
  };
  registerAliases(fastify, 'get', '/mercado-livre/oauth/callback', {}, oauthCallback);

  const webhook = async (request, reply) => {
    const payload = request.body || {};
    const parsed = parseNotificationResource(payload);
    if (!parsed) return reply.code(200).send({ ok: true, ignored: true });
    const settings = await loadSettings(pool);
    if (settings.client_id && payload.application_id && String(payload.application_id) !== String(settings.client_id)) return reply.code(200).send({ ok: true, ignored: true });
    if (settings.user_id && payload.user_id && String(payload.user_id) !== String(settings.user_id)) return reply.code(200).send({ ok: true, ignored: true });
    const eventKey = buildEventKey(payload);
    const [inserted] = await pool.query(
      `INSERT IGNORE INTO mercado_livre_webhook_events (event_key, topic, resource, seller_id, payload) VALUES (?, ?, ?, ?, ?)`,
      [eventKey, parsed.topic, payload.resource, payload.user_id ? String(payload.user_id) : null, JSON.stringify(payload)],
    );
    reply.code(200).send({ ok: true, duplicate: inserted.affectedRows === 0 });
    if (inserted.affectedRows) setImmediate(() => processNotification(pool, eventKey, parsed, { onSale }).catch(error => fastify.log.error({ error }, 'Mercado Livre webhook processing failed')));
    return reply;
  };
  registerAliases(fastify, 'post', '/mercado-livre/webhook', {}, webhook);

  const listJobs = async (request) => {
    const limit = Math.min(100, Math.max(1, Number(request.query?.limit || 30)));
    const [rows] = await pool.query(`SELECT shipment_id, order_id, pack_id, status, shipment_status, shipment_substatus,
      tracking_number, attempts, last_error, label_printed_at, declaration_printed_at, summary_printed_at, created_at, updated_at
      FROM mercado_livre_print_jobs ORDER BY created_at DESC LIMIT ?`, [limit]);
    return { items: rows.map(presentPrintJob) };
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs', protectedRoute, listJobs);

  const listOrders = async (request, reply) => {
    const sales = await loadMercadoLivreSales(pool, request.query?.limit || 500, '', request.query?.start_date, request.query?.end_date);
    reply.header('Cache-Control', 'no-store');
    return { channel: 'mercado_livre', count: sales.length, sales };
  };
  registerAliases(fastify, 'get', '/mercado-livre/orders', protectedRoute, listOrders);

  const nextJob = async (_request, reply) => {
    // Reconcile pending DC-e without depending on a second webhook arriving.
    const [pending] = await pool.query("SELECT shipment_id FROM mercado_livre_print_jobs WHERE status='awaiting_dce' AND shipment_status='ready_to_ship' ORDER BY updated_at ASC LIMIT 1");
    if (pending.length) {
      try {
        const shipment = await (await mlRequest(pool, `/shipments/${encodeURIComponent(pending[0].shipment_id)}`)).json();
        const state = classifyShipment(shipment);
        await pool.query("UPDATE mercado_livre_print_jobs SET status=?, shipment_status=?, shipment_substatus=?, updated_at=NOW() WHERE shipment_id=? AND status='awaiting_dce'",
          [state.printable ? 'ready' : state.needsDce ? 'awaiting_dce' : 'intervention', shipment.status, shipment.substatus || null, pending[0].shipment_id]);
      } catch {
        // Advance the retry clock so one unavailable remessa cannot starve other pending jobs.
        await pool.query("UPDATE mercado_livre_print_jobs SET updated_at=NOW() WHERE shipment_id=? AND status='awaiting_dce'", [pending[0].shipment_id]);
        fastify.log?.warn('Mercado Livre: conciliacao de remessa pendente indisponivel; nova tentativa no proximo ciclo.');
      }
    }
    const legacyDeclarationRecovery = "(status='intervention' AND label_printed_at IS NOT NULL AND declaration_printed_at IS NULL AND summary_printed_at IS NULL AND last_error LIKE '%/declaration: HTTP 409%')";
    const eligibleShipment = `shipment_status='ready_to_ship' AND (shipment_substatus='ready_to_print' OR (${legacyDeclarationRecovery} AND shipment_substatus='printed'))`;
    const eligible = `(status='ready' OR (status='printing' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)) OR ${legacyDeclarationRecovery}) AND ${eligibleShipment}`;
    const [rows] = await pool.query(`SELECT * FROM mercado_livre_print_jobs WHERE ${eligible} ORDER BY created_at ASC LIMIT 1`);
    if (!rows.length) return reply.code(204).send();
    const job = rows[0];
    const [claim] = await pool.query(`UPDATE mercado_livre_print_jobs SET status='printing', attempts=attempts+1, updated_at=NOW() WHERE shipment_id=? AND ${eligible}`, [job.shipment_id]);
    if (!claim.affectedRows) return reply.code(204).send();
    try {
      // Do not print from an old webhook snapshot after a cancellation or dispatch.
      const shipment = await (await mlRequest(pool, `/shipments/${encodeURIComponent(job.shipment_id)}`)).json();
      const state = classifyShipment(shipment);
      const legacyPrintable = job.status === 'intervention' && job.label_printed_at && !job.declaration_printed_at && !job.summary_printed_at
        && String(job.last_error || '').includes('/declaration: HTTP 409')
        && String(shipment.status) === 'ready_to_ship' && ['printed', 'ready_to_print'].includes(String(shipment.substatus || ''));
      if (!state.printable && !legacyPrintable) {
        await pool.query("UPDATE mercado_livre_print_jobs SET status=?, shipment_status=?, shipment_substatus=? WHERE shipment_id=? AND status='printing'",
          [state.needsDce ? 'awaiting_dce' : 'intervention', shipment.status, shipment.substatus || null, job.shipment_id]);
        return reply.code(204).send();
      }
    } catch (error) {
      await pool.query("UPDATE mercado_livre_print_jobs SET status='ready' WHERE shipment_id=? AND status='printing'", [job.shipment_id]);
      throw error;
    }
    return {
      shipmentId: job.shipment_id,
      orderId: job.order_id,
      packId: job.pack_id,
      trackingNumber: job.tracking_number,
      payload: job.payload,
      labelPrintedAt: job.label_printed_at,
      declarationPrintedAt: job.declaration_printed_at,
      summaryPrintedAt: job.summary_printed_at,
    };
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs/next', { preHandler: requireSyncKey }, nextJob);

  const label = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const response = await mlRequest(pool, `/shipment_labels?shipment_ids=${encodeURIComponent(shipmentId)}&response_type=pdf`);
    const pdf = Buffer.from(await response.arrayBuffer());
    return reply.type('application/pdf').header('content-disposition', `inline; filename=ML-${shipmentId}.pdf`).send(pdf);
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs/:shipmentId/label', { preHandler: requireSyncKey }, label);

  const declaration = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const [jobs] = await pool.query('SELECT order_id FROM mercado_livre_print_jobs WHERE shipment_id=? LIMIT 1', [shipmentId]);
    const orderId = String(jobs?.[0]?.order_id || '');
    if (!orderId) return reply.code(404).send({ error: 'Remessa Mercado Livre nao encontrada' });
    const infoResponse = await mlRequest(pool, `/mlb/order/${encodeURIComponent(orderId)}/dce/info`);
    const document = selectDcePdfDocument(await infoResponse.json().catch(() => ({})));
    if (!document) return reply.code(409).send({ error: 'Declaracao DC-e ainda nao esta pronta para impressao' });
    const response = await mlRequest(pool, `/mlb/order/${encodeURIComponent(orderId)}/dce/info/${encodeURIComponent(document.dceKey)}?doctype=pdf`);
    const pdf = Buffer.from(await response.arrayBuffer());
    return reply.type('application/pdf').header('content-disposition', `inline; filename=ML-${shipmentId}-DCE.pdf`).send(pdf);
  };
  registerAliases(fastify, 'get', '/mercado-livre/print-jobs/:shipmentId/declaration', { preHandler: requireSyncKey }, declaration);

  const markStep = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const columns = { label: 'label_printed_at', declaration: 'declaration_printed_at', summary: 'summary_printed_at' };
    const column = columns[String(request.body?.step || '')];
    if (!column) return reply.code(400).send({ error: 'Etapa de impressao invalida' });
    const [result] = await pool.query(`UPDATE mercado_livre_print_jobs SET ${column}=COALESCE(${column},NOW()), last_error=NULL WHERE shipment_id=?`, [shipmentId]);
    if (!result.affectedRows) return reply.code(404).send({ error: 'Remessa Mercado Livre nao encontrada' });
    return { ok: true, step: request.body.step };
  };
  registerAliases(fastify, 'post', '/mercado-livre/print-jobs/:shipmentId/step', { preHandler: requireSyncKey }, markStep);

  const completeJob = async (request, reply) => {
    const shipmentId = String(request.params.shipmentId || '');
    const body = request.body || {};
    if (body.ok === false) {
      const nextStatus = body.retryable ? 'ready' : 'intervention';
      await pool.query('UPDATE mercado_livre_print_jobs SET status=?, last_error=? WHERE shipment_id=?', [nextStatus, String(body.error || 'Falha de impressao').slice(0, 2000), shipmentId]);
    } else {
      const [jobs] = await pool.query('SELECT label_printed_at, declaration_printed_at, summary_printed_at FROM mercado_livre_print_jobs WHERE shipment_id=? LIMIT 1', [shipmentId]);
      if (!jobs.length) return reply.code(404).send({ error: 'Remessa Mercado Livre nao encontrada' });
      const missing = [
        !jobs[0].label_printed_at && 'etiqueta',
        !jobs[0].declaration_printed_at && 'declaracao',
        !jobs[0].summary_printed_at && 'comprovante',
      ].filter(Boolean);
      if (missing.length) return reply.code(409).send({ error: `Impressao incompleta: ${missing.join(', ')}` });
      await pool.query("UPDATE mercado_livre_print_jobs SET status='printed', last_error=NULL WHERE shipment_id=?", [shipmentId]);
    }
    return reply.send({ ok: true });
  };
  registerAliases(fastify, 'post', '/mercado-livre/print-jobs/:shipmentId/complete', { preHandler: requireSyncKey }, completeJob);

  const emitDce = async (request) => {
    const orderId = String(request.params.orderId || '');
    const response = await mlRequest(pool, `/mlb/order/${encodeURIComponent(orderId)}/dce/emission`, { method: 'POST', body: '{}' });
    return response.json().catch(() => ({ ok: true }));
  };
  registerAliases(fastify, 'post', '/mercado-livre/orders/:orderId/dce', protectedRoute, emitDce);

  const listingHandlers = createListingHandlers({ pool, settings: () => loadSettings(pool), request: async path => (await mlRequest(pool, path)).json() });
  const presentListingError = handler => async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return await handler(req); }
    catch (error) { return reply.code(error.statusCode || 502).send({ error: error.statusCode ? error.message : 'Consulta ao Mercado Livre indisponível. Confira a conexão; se a busca expirou, reinicie a consulta.' }); }
  };
  const linkProduct = presentListingError(listingHandlers.link);
  const listingPrices = createListingPriceHandlers({ pool, settings: () => loadSettings(pool),
    request: async (path, options) => (await mlRequest(pool, path, options)).json() });
  const listingStock = createListingStockHandlers({ pool, settings: () => loadSettings(pool),
    request: async (path, options) => mlRequest(pool, path, options) });
  registerAliases(fastify, 'get', '/mercado-livre/products/items/:itemId/price', erpReadRoute, presentListingError(listingPrices.read));
  registerAliases(fastify, 'post', '/mercado-livre/products/items/:itemId/price', protectedRoute, presentListingError(listingPrices.update));
  registerAliases(fastify, 'get', '/mercado-livre/products/items/:itemId/stock', erpReadRoute, presentListingError(listingStock.read));
  registerAliases(fastify, 'get', '/mercado-livre/products/discover', erpReadRoute, presentListingError(listingHandlers.discover));
  const listErpProducts = async (request, reply) => {
    const query = request.query || {};
    const limitRaw = String(query.limit ?? '50');
    if (!/^\d{1,2}$/.test(limitRaw)) {
      return reply.code(400).send({ error: 'Paginação de produtos inválida.' });
    }
    reply.header('Cache-Control', 'no-store');
    try {
      return await loadMercadoLivreErpProducts(pool, { after: query.after ?? '', limit: Number(limitRaw) });
    } catch (error) {
      return reply.code(error.statusCode || 502).send({ error: error.statusCode
        ? error.message : 'Consulta do catálogo de produtos indisponível.' });
    }
  };
  registerAliases(fastify, 'get', '/mercado-livre/erp/products', erpReadRoute, listErpProducts);
  const listErpOrders = async (request, reply) => {
    const query = request.query || {};
    const limitRaw = String(query.limit ?? '50');
    const offsetRaw = String(query.offset ?? '0');
    const dateField = query.date_field ?? 'created';
    if (!/^\d{1,2}$/.test(limitRaw) || !/^\d{1,5}$/.test(offsetRaw)) {
      return reply.code(400).send({ error: 'Paginação de pedidos inválida.' });
    }
    if (!['created', 'updated'].includes(dateField)) {
      return reply.code(400).send({ error: 'Campo de data de pedido inválido.' });
    }
    const startDate = validErpOrderDate(query.start_date);
    const endDate = validErpOrderDate(query.end_date, true);
    if (startDate === null || endDate === null || (startDate && endDate && startDate > endDate)) {
      return reply.code(400).send({ error: 'Intervalo de datas inválido.' });
    }
    if ((startDate || endDate) && (!startDate || !endDate)) {
      return reply.code(400).send({ error: 'Informe as duas datas do período.' });
    }
    reply.header('Cache-Control', 'no-store');
    try {
      return await loadMercadoLivreOrdersForErp(pool, {
        limit: Number(limitRaw), offset: Number(offsetRaw), startDate, endDate, dateField,
      });
    } catch (error) {
      return reply.code(error.statusCode || 502).send({ error: error.statusCode
        ? error.message : 'Consulta de pedidos do Mercado Livre indisponível.' });
    }
  };
  registerAliases(fastify, 'get', '/mercado-livre/erp/orders', erpReadRoute, listErpOrders);
  registerAliases(fastify, 'get', '/mercado-livre/products/candidates', protectedRoute, presentListingError(listingHandlers.candidates));
  registerAliases(fastify, 'post', '/mercado-livre/products/link', protectedRoute, linkProduct);
  registerAliases(fastify, 'get', '/mercado-livre/products/links', protectedRoute, async () => {
    const [rows] = await pool.query('SELECT * FROM mercado_livre_products ORDER BY created_at DESC');
    return { items: rows };
  });
}

module.exports = {
  loadMercadoLivreSales,
  mercadoLivrePaidOrderToMobileSale,
  isNonBlockingValidation,
  listingRows, suggestListingLinks, createListingHandlers,
  ensureMercadoLivreTables,
  registerMercadoLivreRoutes,
  matchesMercadoLivreErpReadKey,
  requireMercadoLivreErpRead,
  syncMercadoLivreStockFromBlingTargets,
  parseNotificationResource,
  classifyShipment,
  normalizeAvailableQuantity,
  buildEventKey,
  createPkcePair,
  mercadoLivreOrderToErpReview,
  loadMercadoLivreOrdersForErp,
  loadMercadoLivreErpProducts,
  validErpOrderDate,
  selectDcePdfDocument,
  isClosedShipment,
  presentPrintJob,
};
