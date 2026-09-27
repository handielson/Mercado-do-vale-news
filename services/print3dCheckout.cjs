'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { validateQuoteItems } = require('./print3dStorefrontQuote.cjs');
const { reservePriorityStockOnConnection } = require('./priorityStockReservation.cjs');
const { savePrint3dOrderPlanOnConnection } = require('./print3dOrderPlan.cjs');
const { createProductionJobsOnConnection } = require('./print3dProduction.cjs');
const { quoteItemsFingerprint } = require('./print3dShippingQuoteToken.cjs');
const { buildPaymentTerms } = require('./print3dPaymentTerms.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(statusCode,message) { throw Object.assign(new Error(message),{ statusCode }); }
function hash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function validateCheckout(body) {
  if (!body || !UUID.test(body.idempotency_key || '')) fail(400,'Identificador do checkout inválido.');
  let items;
  try { items = validateQuoteItems(body.items).sort((a,b) => a.product_id.localeCompare(b.product_id)); }
  catch (error) { fail(400,error.message); }
  if (!items.every(item => UUID.test(item.product_id))) fail(400,'Produto inválido.');
  const source = body.shipping_address;
  if (!source || typeof source !== 'object') fail(400,'Informe o endereço de entrega.');
  const address = {};
  for (const [field,max] of Object.entries({cep:9,street:180,number:30,complement:120,neighborhood:100,city:100,state:2})) {
    const value = source[field] ?? '';
    if (typeof value !== 'string' || value.length > max || /[\x00-\x1f]/.test(value)) fail(400,'Endereço inválido.');
    address[field] = value.trim();
    if (!address[field] && field !== 'complement') fail(400,'Complete o endereço de entrega.');
  }
  address.cep = address.cep.replace(/\D/g,'');
  address.state = address.state.toUpperCase();
  if (!/^\d{8}$/.test(address.cep) || /^0+$/.test(address.cep) || !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(address.state)) fail(400,'CEP ou estado inválido.');
  if (typeof body.shipping_option_id !== 'string' || !body.shipping_option_id || body.shipping_option_id.length > 150
    || typeof body.quote_token !== 'string' || !body.quote_token || body.quote_token.length > 30000) fail(400,'Calcule e selecione o frete.');
  const terms = buildPaymentTerms(100, 0, body.payment_terms);
  const paymentTerms = {initial_payment_bps:terms.initial_payment_bps,shipping_payment_mode:terms.shipping_payment_mode};
  const input = { items,shipping_address:address,shipping_option_id:body.shipping_option_id,quote_token:body.quote_token,payment_terms:paymentTerms };
  // Refreshing the signed quote must not strand a committed order after a lost response.
  // A replay returns that immutable order; only new orders consume the refreshed quote.
  const {quote_token:quoteToken,...intent} = input;
  return { ...input,idempotency_key:body.idempotency_key.toLowerCase(),payload_hash:hash(intent) };
}
function parseJson(value) { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return null; } }
function projectOrder(row,items) {
  const subtotal = Number(row.subtotal), shipping = Number(row.shipping_cost), total = Number(row.total);
  const hasPreorder = Number(row.preorder_amount_cents) > 0;
  const initial = Number(row.payment_terms_version) === 1 || hasPreorder ? Number(row.due_on_confirmation_cents) : total;
  const confirmed = Number(row.confirmed_cents || 0);
  return {
    id:row.id,order_number:'3D-' + String(row.public_number),status:row.status,payment_status:row.payment_status,
    created_at:row.created_at,subtotal_cents:subtotal,shipping_cents:shipping,total_cents:total,
    shipping_address:parseJson(row.shipping_address),shipping_option:parseJson(row.option_snapshot),
    items:items.map(item => ({ product_id:item.product_id,product_name:item.product_name,product_sku:item.product_sku,
      quantity:Number(item.quantity),unit_price_cents:Number(item.unit_price),subtotal_cents:Number(item.subtotal),
      ready_quantity:Number(item.ready_quantity),preorder_quantity:Number(item.preorder_quantity),
      production_days:item.production_days == null ? null : Number(item.production_days) })),
    payment_schedule:{due_on_confirmation_cents:Number(row.due_on_confirmation_cents),due_before_shipping_cents:Number(row.due_before_shipping_cents),
      shipping_cents:shipping,initial_cents:initial,balance_cents:total-initial,
      payment_terms_version:Number(row.payment_terms_version || 0),
      initial_payment_bps:Number(row.initial_payment_bps || 5000),shipping_payment_mode:row.shipping_payment_mode || 'later',
      shipping_initial_cents:Number(row.shipping_initial_cents || 0),minimum_initial_cents:Number(row.minimum_initial_cents || initial)},
    confirmed_cents:confirmed,outstanding_cents:Math.max(0,total-confirmed),
  };
}
async function listPrint3dOrders(connection,{customerId,orderId}) {
  if (!UUID.test(customerId || '')) fail(401,'Entre na sua conta 3D.');
  if (orderId && !UUID.test(orderId)) fail(404,'Pedido não encontrado.');
  const [rows] = await connection.query(`SELECT o.*,p.public_number,p.preorder_amount_cents,p.due_on_confirmation_cents,p.due_before_shipping_cents,
    p.payment_terms_version,p.initial_payment_bps,p.shipping_payment_mode,p.shipping_initial_cents,p.minimum_initial_cents,s.option_snapshot,
    (SELECT COALESCE(SUM(r.amount_cents),0) FROM print3d_order_payment_receipts r WHERE r.order_id=o.id AND r.status='confirmed') AS confirmed_cents
    FROM orders o JOIN print3d_order_plans p ON p.order_id=o.id
    JOIN print3d_order_shipping s ON s.order_id=o.id
    WHERE o.storefront='loja_3d' AND o.customer_id IS NULL AND o.print3d_customer_id=? ${orderId ? 'AND o.id=?' : ''}
    ORDER BY o.created_at DESC,o.id DESC LIMIT 100`,orderId ? [customerId,orderId] : [customerId]);
  if (orderId && !rows.length) fail(404,'Pedido não encontrado.');
  if (!rows.length) return [];
  const [items] = await connection.query(`SELECT i.*,p.ready_quantity,p.preorder_quantity,p.production_days FROM order_items i
    JOIN print3d_order_item_plans p ON p.order_item_id=i.id AND p.order_id=i.order_id
    WHERE i.order_id IN (${rows.map(() => '?').join(',')}) ORDER BY i.id`,rows.map(row => row.id));
  return rows.map(row => projectOrder(row,items.filter(item => item.order_id === row.id)));
}
async function insert(connection,table,row) {
  await connection.query(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`,Object.values(row));
}
// Entire checkout, reservation, immutable plan and production snapshot commit together.
async function createPrint3dCheckout(pool,{customerId,authVersion,body,companyId,loadQuote,verifyShipping,
  reserveStock = reservePriorityStockOnConnection,savePlan = savePrint3dOrderPlanOnConnection,
  createProduction = createProductionJobsOnConnection,readOrders = listPrint3dOrders}) {
  const input = validateCheckout(body);
  if (!UUID.test(customerId || '')) fail(401,'Entre na sua conta 3D.');
  if (!Number.isSafeInteger(authVersion) || authVersion < 1) fail(401,'Sessão inválida. Entre novamente na sua conta 3D.');
  if (!UUID.test(companyId || '')) fail(503,'Empresa da loja 3D ainda não configurada.');
  const connection = await pool.getConnection();
  try {
    // Avoid an older repeatable-read snapshot from the idempotency lookup:
    // catalog reads after waiting for stock locks must observe the winner's commit.
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    // Serializes retries for this customer before reservation, including concurrent same-key calls.
    const [customers] = await connection.query('SELECT id,name,email,phone,is_active,email_verified_at,phone_verified_at FROM print3d_customers WHERE id=? FOR UPDATE',[customerId]);
    const customer = customers[0];
    if (!customer || Number(customer.is_active) !== 1 || !(customer.email_verified_at || customer.phone_verified_at)) fail(403,'Valide sua conta 3D antes de comprar.');
    const [authRows] = await connection.query('SELECT auth_version FROM print3d_customer_auth WHERE customer_id=? FOR UPDATE',[customerId]);
    if (!authRows[0] || Number(authRows[0].auth_version) !== authVersion) fail(401,'Sua sessão foi encerrada. Entre novamente na conta 3D.');
    const [existing] = await connection.query('SELECT * FROM print3d_checkout_requests WHERE customer_id=? AND idempotency_key=?',[customerId,input.idempotency_key]);
    if (existing[0]) {
      if (existing[0].payload_hash !== input.payload_hash) fail(409,'Esta tentativa já foi usada para outro pedido.');
      const [order] = await readOrders(connection,{customerId,orderId:existing[0].order_id});
      await connection.commit();
      return {order,replayed:true};
    }
    const shipping = await verifyShipping({token:input.quote_token,items:input.items,cep:input.shipping_address.cep,shippingOptionId:input.shipping_option_id});
    if (!shipping?.option || shipping.option.id !== input.shipping_option_id || !Number.isSafeInteger(shipping.option.price_cents) || shipping.option.price_cents < 0) fail(409,'Cotação de frete inválida. Calcule novamente.');
    // Global product locks always follow the same order as the canonical reservation.
    for (const item of input.items) {
      const [products] = await connection.query('SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE',[item.product_id]);
      if (!products[0] || products[0].company_id !== companyId) fail(409,'Produto indisponível nesta loja.');
      await connection.query("SELECT product_id FROM product_storefront_offers WHERE product_id=? AND storefront='loja_3d' FOR UPDATE",[item.product_id]);
      const [locations] = await connection.query('SELECT id,company_id FROM product_stock_locations WHERE product_id=? ORDER BY id FOR UPDATE',[item.product_id]);
      if (locations.some(location => location.company_id && location.company_id !== companyId)) fail(409,'Localização de estoque incompatível com a empresa.');
    }
    const quote = await loadQuote(connection,input.items);
    if (!quote?.paymentSchedule || !quote.items.every(item => item.status === 'available')) fail(409,'Revise os itens e a disponibilidade.');
    if (quoteItemsFingerprint(quote.items) !== shipping.items_fingerprint || quote.paymentSchedule.subtotal !== shipping.subtotal_cents) fail(409,'Preço, estoque ou prazo mudou. Calcule o frete novamente e revise o pedido.');
    if (quote.items.some(item => item.preorder_quantity > 0) && !customer.phone_verified_at) fail(403,'Valide seu WhatsApp para fazer encomendas.');
    const total = quote.paymentSchedule.subtotal + shipping.option.price_cents;
    if (!Number.isSafeInteger(total)) fail(400,'Total acima do limite.');
    const orderId = randomUUID();
    const reservations = [];
    await insert(connection,'orders',{id:orderId,company_id:companyId,storefront:'loja_3d',customer_id:null,print3d_customer_id:customerId,
      customer_name:customer.name,customer_phone:customer.phone || '',customer_email:customer.email || null,
      status:'awaiting_payment',payment_status:'pending',payment_method:'pix',delivery_type:'delivery',
      shipping_address:JSON.stringify(input.shipping_address),shipping_cost:shipping.option.price_cents,
      subtotal:quote.paymentSchedule.subtotal,discount:0,total});
    for (const item of quote.items) {
      await insert(connection,'order_items',{id:randomUUID(),order_id:orderId,product_id:item.product_id,product_name:item.name,
        product_sku:item.sku || null,quantity:item.quantity,unit_price:item.unit_price,subtotal:item.subtotal});
      if (item.ready_quantity > 0) {
        const result = await reserveStock(connection,{product_id:item.product_id,quantity:item.ready_quantity,
          reason:'Reserva checkout loja 3D',reference_type:'order_reservation',reference_id:orderId});
        if (result.status !== 200) fail(409,'Estoque mudou ou está sem localização. Revise o pedido.');
        if (!Array.isArray(result.reservations) || result.reservations.some(source => !UUID.test(source.stock_location_id || '')
          || !Number.isSafeInteger(source.quantity_reserved) || source.quantity_reserved <= 0)
          || result.reservations.reduce((sum,source) => sum + source.quantity_reserved,0) !== item.ready_quantity) fail(409,'Reserva sem rastreabilidade de localização.');
        for (const source of result.reservations || []) reservations.push({order_id:orderId,product_id:item.product_id,
          stock_location_id:source.stock_location_id,deposit_id:source.deposit_id,location_id:source.location_id,
          quantity_reserved:source.quantity_reserved});
      }
    }
    await savePlan(connection,{orderId,quoteItems:quote.items,paymentTerms:input.payment_terms});
    for (const reservation of reservations) await insert(connection,'print3d_order_stock_reservations',reservation);
    await createProduction(connection,{orderId});
    await insert(connection,'print3d_order_shipping',{order_id:orderId,option_snapshot:JSON.stringify({...shipping.option,
      production_days:shipping.production_days,handling_business_days:shipping.handling_business_days,
      origin_cep:shipping.origin_cep,parcel:shipping.parcel})});
    await insert(connection,'print3d_checkout_requests',{customer_id:customerId,idempotency_key:input.idempotency_key,payload_hash:input.payload_hash,order_id:orderId});
    const [order] = await readOrders(connection,{customerId,orderId});
    await connection.commit();
    return {order,replayed:false};
  } catch (error) { try { await connection.rollback(); } catch {} throw error; }
  finally { connection.release(); }
}
module.exports = { validateCheckout,projectOrder,listPrint3dOrders,createPrint3dCheckout };
