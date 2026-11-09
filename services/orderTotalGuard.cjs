'use strict';

// order-total-guard-v1: o pedido online é montado no navegador (services/orderService.ts),
// então o servidor confere os valores antes de aceitar os itens de um pedido de CLIENTE.
//
// Estratégia: em vez de reproduzir qual caminho de preço o navegador usou, calcula o MENOR
// preço legítimo de cada produto para aquele cliente (preço do tipo de cliente, promoção
// vigente, preço de kit pela quantidade, desconto percentual de combo, e o mesmo para as
// variações filhas). Pagar acima disso nunca é risco; abaixo é recusado.
// Garantia estendida ainda não tem dado estruturado no pedido: só recebe limites de segurança.

const PRICE_FIELD = { retail: 'price_retail', resale: 'price_reseller', wholesale: 'price_wholesale' };
const PROMO_GRACE_MS = 24 * 60 * 60 * 1000; // carrinho pode ter guardado a promo que acabou de vencer
const TOLERANCE_CENTS = 1;

function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : NaN;
}

function normalizeCustomerType(value) {
  const type = String(value || '').toLowerCase();
  return PRICE_FIELD[type] ? type : 'retail';
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function isWarrantyLine(item) {
  return /^\s*garantia estendida\b/iu.test(String(item?.product_name || ''));
}

function isPromoActive(row, now) {
  const promo = cents(row.price_promo);
  if (!(promo > 0)) return false;
  const start = row.promo_start ? new Date(row.promo_start).getTime() : null;
  const end = row.promo_end ? new Date(row.promo_end).getTime() : null;
  if (start != null && Number.isFinite(start) && start > now + PROMO_GRACE_MS) return false;
  if (end != null && Number.isFinite(end) && end < now - PROMO_GRACE_MS) return false;
  return true;
}

// Menor preço unitário legítimo (centavos) entre o produto e suas variações; null se não há preço.
function productFloorCents({ rows, quantity, customerType, now = Date.now() }) {
  const field = PRICE_FIELD[normalizeCustomerType(customerType)];
  const candidates = [];
  for (const row of rows || []) {
    if (!row) continue;
    const typePrice = cents(row[field]) > 0 ? cents(row[field]) : cents(row.price_retail);
    if (typePrice > 0) {
      candidates.push(typePrice);
      const percent = Number(row.discount_percentage || 0);
      if (percent > 0 && percent < 100) candidates.push(Math.round(typePrice * (1 - percent / 100)));
    }
    if (isPromoActive(row, now)) candidates.push(cents(row.price_promo));
    for (const kit of parseJson(row.kits, []) || []) {
      const kitQuantity = Number(kit?.quantity || 0);
      const kitPrice = cents(kit?.price);
      if (kitQuantity > 0 && kitPrice > 0 && Number(quantity) >= kitQuantity) candidates.push(Math.floor(kitPrice / kitQuantity));
    }
  }
  const positive = candidates.filter((value) => Number.isFinite(value) && value > 0);
  return positive.length ? Math.min(...positive) : null;
}

const COUPON_TARGETS = { retail: 'varejo', resale: 'revenda', wholesale: 'atacado' };

function couponAllowanceCents(coupon, baseCents) {
  const value = Number(coupon?.value || 0);
  const raw = coupon?.type === 'percent' ? Math.round((baseCents * value) / 100) : Math.round(value * 100);
  return Math.max(0, Math.min(raw, baseCents));
}

function couponMatchesCustomer(coupon, customerType) {
  const target = String(coupon?.target_type || 'all');
  if (target === 'all') return true;
  const type = String(customerType || '').toLowerCase();
  return target === customerType || target === type || target === COUPON_TARGETS[normalizeCustomerType(type)];
}

// Confere um pedido completo. Puro: recebe tudo carregado.
function verifyOrderTotals({ order, items, productRows, customerType, coupon, warrantyOptions, now = Date.now() }) {
  const errors = [];
  const warnings = [];
  const add = (list, code, detail) => list.push({ ...detail, code });

  const rowsByProduct = new Map();
  // Cada produto conta com a própria linha e com as variações filhas (parent_id).
  for (const row of productRows || []) {
    const id = String(row.id);
    if (!rowsByProduct.has(id)) rowsByProduct.set(id, []);
    rowsByProduct.get(id).unshift(row);
    if (row.parent_id) {
      const parentId = String(row.parent_id);
      if (!rowsByProduct.has(parentId)) rowsByProduct.set(parentId, []);
      rowsByProduct.get(parentId).push(row);
    }
  }

  const productLines = [];
  const warrantyLines = [];
  for (const item of items || []) (isWarrantyLine(item) ? warrantyLines : productLines).push(item);

  let productSubtotal = 0;
  for (const item of productLines) {
    const quantity = Number(item.quantity);
    const unit = cents(item.unit_price);
    const subtotal = cents(item.subtotal);
    if (!Number.isInteger(quantity) || quantity <= 0) { add(errors, 'invalid_quantity', { product_id: item.product_id }); continue; }
    if (!(unit >= 0) || !(subtotal >= 0)) { add(errors, 'invalid_price', { product_id: item.product_id }); continue; }
    if (Math.abs(subtotal - unit * quantity) > TOLERANCE_CENTS) add(errors, 'line_subtotal_mismatch', { product_id: item.product_id, unit, quantity, subtotal });
    const rows = rowsByProduct.get(String(item.product_id || ''));
    if (!rows || !rows.length) { add(errors, 'unknown_product', { product_id: item.product_id }); continue; }
    const floor = productFloorCents({ rows, quantity, customerType, now });
    if (floor == null) add(warnings, 'item_without_price', { product_id: item.product_id, unit });
    else if (unit < floor - TOLERANCE_CENTS) add(errors, 'item_below_price', { product_id: item.product_id, unit, floor });
    productSubtotal += subtotal;
  }

  let warrantySubtotal = 0;
  if (warrantyLines.length) {
    const percents = (warrantyOptions || []).filter((o) => o && o.active !== false).map((o) => Number(o.percentage || 0)).filter((p) => p > 0);
    const maxPercent = percents.length ? Math.max(...percents) : 0;
    const productIds = new Set(productLines.map((item) => String(item.product_id || '')));
    const cap = Math.round((productSubtotal * maxPercent) / 100);
    for (const item of warrantyLines) {
      // O checkout às vezes grava subtotal diferente do unit_price nesta linha; vale o maior dos dois.
      const charged = Math.max(cents(item.unit_price) || 0, cents(item.subtotal) || 0);
      const quantity = Number(item.quantity);
      if (quantity !== 1) add(errors, 'warranty_quantity', { quantity });
      if (item.product_id && !productIds.has(String(item.product_id))) add(errors, 'warranty_without_base_item', { product_id: item.product_id });
      if (!(charged > 0)) add(errors, 'warranty_invalid_value', { charged });
      else if (!maxPercent) add(errors, 'warranty_not_offered', { charged });
      else if (charged > cap + TOLERANCE_CENTS) add(errors, 'warranty_above_limit', { charged, cap, maxPercent });
      else add(warnings, 'warranty_unverified', { charged, cap, maxPercent });
      warrantySubtotal += cents(item.subtotal) || 0;
    }
  }

  const lineSum = productSubtotal + warrantySubtotal;
  const subtotal = cents(order.subtotal);
  const couponDiscount = cents(order.coupon_discount || 0);
  const coinsDiscount = cents(order.coins_discount || 0);
  const discount = cents(order.discount || 0);
  const shipping = cents(order.shipping_cost || 0);
  const total = cents(order.total);

  if (Math.abs(subtotal - lineSum) > TOLERANCE_CENTS * Math.max(1, (items || []).length)) add(errors, 'order_subtotal_mismatch', { subtotal, lineSum });
  if (!(couponDiscount >= 0) || !(coinsDiscount >= 0) || !(shipping >= 0)) add(errors, 'invalid_order_values', { couponDiscount, coinsDiscount, shipping });
  if (Math.abs(discount - (couponDiscount + coinsDiscount)) > TOLERANCE_CENTS) add(errors, 'order_discount_mismatch', { discount, couponDiscount, coinsDiscount });
  if (Math.abs(total - (subtotal - discount + shipping)) > TOLERANCE_CENTS) add(errors, 'order_total_mismatch', { total, expected: subtotal - discount + shipping });
  if (total < 0) add(errors, 'negative_total', { total });

  if (couponDiscount > 0) {
    if (!order.coupon_code || !coupon) add(errors, 'coupon_not_found', { coupon_code: order.coupon_code || null });
    else {
      if (!couponMatchesCustomer(coupon, customerType)) add(errors, 'coupon_customer_type', { coupon_code: coupon.code });
      if (productSubtotal < Math.round(Number(coupon.min_order || 0) * 100)) add(errors, 'coupon_min_order', { coupon_code: coupon.code, productSubtotal });
      const allowed = couponAllowanceCents(coupon, productSubtotal);
      if (couponDiscount > allowed + TOLERANCE_CENTS) add(errors, 'coupon_above_allowed', { coupon_code: coupon.code, couponDiscount, allowed });
    }
  }

  if (order.delivery_type === 'delivery' && shipping === 0) add(warnings, 'shipping_not_verified', { shipping });

  return { ok: errors.length === 0, errors, warnings, productSubtotal };
}

const ERROR_MESSAGES = {
  item_below_price: 'O preço de um item não confere com o catálogo. Atualize o carrinho e tente de novo.',
  coupon_above_allowed: 'O desconto do cupom não confere. Aplique o cupom novamente.',
  coupon_not_found: 'Cupom inválido para este pedido.',
  coupon_min_order: 'O pedido não atinge o valor mínimo do cupom.',
  coupon_customer_type: 'Cupom não disponível para o seu tipo de cliente.',
  warranty_above_limit: 'O valor da garantia estendida não confere.',
};

function messageFor(errors) {
  for (const error of errors) if (ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
  return 'Os valores do pedido não conferem. Atualize o carrinho e tente de novo.';
}

// Carrega do banco e confere os itens que um CLIENTE está gravando (POST /table-data/order_items/bulk).
async function guardCustomerOrderItems(pool, newItems, { now = Date.now(), logger = console } = {}) {
  const items = Array.isArray(newItems) ? newItems : [];
  const orderIds = [...new Set(items.map((item) => String(item?.order_id || '')).filter(Boolean))];
  if (orderIds.length !== 1) return { ok: false, status: 400, body: { error: 'Itens de pedidos diferentes no mesmo envio.', code: 'mixed_orders' } };
  const orderId = orderIds[0];

  const [orders] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const order = orders?.[0];
  if (!order) return { ok: false, status: 404, body: { error: 'Pedido não encontrado.', code: 'order_not_found' } };

  const [existing] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const allItems = [...(existing || []), ...items];
  const productIds = [...new Set(allItems.filter((item) => !isWarrantyLine(item)).map((item) => String(item.product_id || '')).filter(Boolean))];

  let productRows = [];
  if (productIds.length) {
    const marks = productIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id, parent_id, price_retail, price_reseller, price_wholesale, price_promo, promo_start, promo_end, kits, discount_percentage
         FROM products WHERE id IN (${marks}) OR parent_id IN (${marks})`,
      [...productIds, ...productIds]
    );
    productRows = rows || [];
    // Preço publicado por site (product_storefront_offers) também é legítimo: entra como candidato
    // a menor preço. Só pode baixar o piso; nunca causa recusa. A tabela pode não existir ainda.
    try {
      const [offers] = await pool.query(
        `SELECT product_id, price_retail, price_reseller, price_wholesale, price_promo
           FROM product_storefront_offers
          WHERE product_id IN (${marks}) AND storefront = 'mercado_do_vale' AND publication_status = 'published'`,
        productIds
      );
      for (const offer of offers || []) {
        productRows.push({ id: offer.product_id, parent_id: null, price_retail: offer.price_retail, price_reseller: offer.price_reseller, price_wholesale: offer.price_wholesale, price_promo: offer.price_promo, promo_start: null, promo_end: null, kits: null, discount_percentage: null });
      }
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }

  let customerType = 'retail';
  if (order.customer_id) {
    const [customers] = await pool.query('SELECT customer_type FROM customers WHERE id = ? LIMIT 1', [order.customer_id]);
    customerType = normalizeCustomerType(customers?.[0]?.customer_type);
  }

  let coupon = null;
  if (order.coupon_code) {
    const [coupons] = await pool.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [String(order.coupon_code).toUpperCase()]);
    coupon = coupons?.[0] || null;
  }

  let warrantyOptions = [];
  if (allItems.some(isWarrantyLine)) {
    const [settings] = await pool.query('SELECT extended_warranty_options FROM company_settings LIMIT 1');
    warrantyOptions = parseJson(settings?.[0]?.extended_warranty_options, []) || [];
  }

  const result = verifyOrderTotals({ order, items: allItems, productRows, customerType, coupon, warrantyOptions, now });
  if (result.errors.length || result.warnings.length) {
    const log = result.errors.length ? logger.warn : logger.info;
    log.call(logger, '[order-total-guard]', JSON.stringify({ order_id: orderId, ok: result.ok, errors: result.errors, warnings: result.warnings }));
  }
  if (!result.ok) return { ok: false, status: 409, body: { error: messageFor(result.errors), code: result.errors[0].code } };
  return { ok: true, warnings: result.warnings };
}

module.exports = {
  isWarrantyLine,
  productFloorCents,
  couponAllowanceCents,
  couponMatchesCustomer,
  verifyOrderTotals,
  guardCustomerOrderItems,
  normalizeCustomerType,
};
