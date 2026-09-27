'use strict';
const crypto = require('node:crypto');
const { readPrint3dPaymentCoverageOnConnection: readCoverage, recordVerifiedPrint3dPaymentOnConnection: recordReceipt } = require('./print3dOrderPlan.cjs');
const { releaseProductionJobsOnConnection: releaseJobs, UUID } = require('./print3dProduction.cjs');
const { recordLatePrint3dPaymentOnConnection } = require('./print3dCancellation.cjs');
function fail(code, message) { throw Object.assign(new Error(message), { statusCode:code }); }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function paymentsConfigured(env = process.env) {
  let notificationUrl;
  try { notificationUrl = new URL(env.MDV_PRINT3D_MP_NOTIFICATION_URL); } catch { return false; }
  return env.MDV_PRINT3D_PAYMENTS_ENABLED === '1' && Boolean(env.MDV_PRINT3D_MP_ACCESS_TOKEN)
    && /^\d+$/.test(env.MDV_PRINT3D_MP_COLLECTOR_ID || '') && Boolean(env.MDV_PRINT3D_MP_WEBHOOK_SECRET)
    && notificationUrl.protocol === 'https:' && !notificationUrl.username && !notificationUrl.password
    && notificationUrl.pathname === '/print3d/payments/webhook' && !notificationUrl.search && !notificationUrl.hash;
}
function publicCharge(row) {
  return { id:row.id, stage:row.stage, amount_cents:Number(row.amount_cents), status:row.status === 'provider_cancelled' ? 'cancelled' : row.status,
    pix_code:row.status === 'pending' ? row.pix_code || '' : '',
    pix_qr_base64:row.status === 'pending' ? row.pix_qr_base64 || '' : '', expires_at:row.expires_at || null };
}
function moneyCents(value) {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) fail(409, 'Valor inválido retornado pelo pagamento.');
  const [whole,fraction=''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents < 1) fail(409, 'Valor inválido retornado pelo pagamento.');
  return cents;
}
function verifyPayment(payment, charge, collectorId) {
  if (!payment || !/^\d+$/.test(String(payment.id || '')) || String(payment.collector_id) !== String(collectorId)
    || payment.currency_id !== 'BRL' || payment.payment_method_id !== 'pix'
    || payment.external_reference !== `print3d:${charge.id}` || moneyCents(payment.transaction_amount) !== Number(charge.amount_cents)
    || (charge.provider_payment_id && String(payment.id) !== String(charge.provider_payment_id))) fail(409, 'Pagamento não corresponde à cobrança 3D.');
  if (!['pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back'].includes(payment.status)) fail(409, 'Estado de pagamento desconhecido.');
  return payment;
}
function verifyWebhook({ headers,query,body }, secret, now = Date.now()) {
  const id = String(query?.['data.id'] || ''), requestId = headers?.['x-request-id'];
  const signature = headers?.['x-signature'];
  if (!/^\d+$/.test(id) || !requestId || typeof requestId !== 'string' || requestId.length > 200
    || !/^[A-Za-z0-9-]+$/.test(requestId) || typeof signature !== 'string' || !secret) fail(401, 'Notificação inválida.');
  const parts = Object.fromEntries(signature.split(',').map(v=>v.trim().split('=')));
  if (!/^\d{10,13}$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) fail(401, 'Assinatura inválida.');
  const timestamp = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 10 * 60 * 1000) fail(401, 'Notificação expirada.');
  const expected = crypto.createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${parts.ts};`).digest();
  if (!crypto.timingSafeEqual(expected,Buffer.from(parts.v1,'hex')) || (body?.data?.id != null && String(body.data.id) !== id)
    || body?.type !== 'payment') fail(401, 'Assinatura inválida.');
  return id;
}
function createMpAdapter(env, fetchImpl = globalThis.fetch) {
  async function request(path, options = {}) {
    let response;
    try { response = await fetchImpl(`https://api.mercadopago.com/v1/payments${path}`, {
      ...options, headers:{ Authorization:`Bearer ${env.MDV_PRINT3D_MP_ACCESS_TOKEN}`, 'Content-Type':'application/json',...options.headers },
      signal:AbortSignal.timeout(15000) }); }
    catch { fail(502,'Não foi possível consultar o PIX. Tente novamente; a mesma cobrança será recuperada.'); }
    if (!response.ok) fail(502,'O provedor não concluiu a solicitação do PIX. Tente novamente.');
    try { return await response.json(); } catch { fail(502,'Resposta inválida do provedor PIX.'); }
  }
  return {
    create:charge=>request('', { method:'POST',headers:{'X-Idempotency-Key':charge.id},body:JSON.stringify({
      transaction_amount:Number(charge.amount_cents)/100,description:`Loja 3D - ${charge.stage === 'initial' ? 'pagamento inicial' : 'saldo e frete'}`,
      payment_method_id:'pix',external_reference:`print3d:${charge.id}`,notification_url:env.MDV_PRINT3D_MP_NOTIFICATION_URL,
      payer:{email:charge.payer_email} }) }),
    findByReference:async chargeId=>{
      if (!UUID.test(chargeId || '')) fail(400,'Cobrança inválida.');
      const query = new URLSearchParams({external_reference:`print3d:${chargeId}`,sort:'date_created',criteria:'desc'});
      const data = await request(`/search?${query}`);
      if (!Array.isArray(data?.results) || !Number.isSafeInteger(data?.paging?.total)
        || data.paging.total < 0) fail(502,'Resposta inválida da busca PIX.');
      if (data.paging.total === 0 && data.results.length === 0) return null;
      if (data.paging.total !== 1 || data.results.length !== 1) fail(409,'Busca PIX requer conferência.');
      return data.results[0];
    },
    get:id=>{ if (!/^\d+$/.test(String(id))) fail(400,'Pagamento inválido.'); return request(`/${id}`); },
    cancel:id=>{
      if (!/^\d+$/.test(String(id))) fail(400,'Pagamento inválido.');
      return request(`/${id}`, { method:'PUT',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({status:'cancelled'}) });
    },
  };
}
async function transaction(pool, fn, beforeBegin) {
  const c = await pool.getConnection();
  try { const context = beforeBegin ? await beforeBegin(c) : undefined; await c.beginTransaction(); const value = await fn(c,context); await c.commit(); return value; }
  catch (error) { await c.rollback(); throw error; } finally { c.release(); }
}
async function ownOrder(c, orderId, customerId, allowRefundReview = false) {
  if (!UUID.test(orderId || '')) fail(400,'Pedido inválido.');
  const [rows] = await c.query('SELECT * FROM orders WHERE id=? LIMIT 1 FOR UPDATE',[orderId]);
  const order = rows[0];
  if (!order || order.storefront !== 'loja_3d' || order.customer_id || !order.print3d_customer_id
    || (customerId && order.print3d_customer_id !== customerId)) fail(404,'Pedido não encontrado.');
  if ((!allowRefundReview && order.status === 'cancelled') || order.payment_status === 'failed'
    || (!allowRefundReview && order.payment_status === 'refunded')) fail(409,'Pedido indisponível para pagamento.');
  return order;
}
function stageAmount(stage, plan, coverage, order) {
  if (coverage.fully_paid) fail(409,'Pedido já quitado.');
  if (stage === 'initial') {
    if (coverage.confirmed_cents > 0) fail(409,'Pagamento inicial já confirmado.');
    // The immutable checkout plan is authoritative for every product, including
    // ready stock and the customer's chosen share of shipping paid up front.
    // Historical v0 ready-stock orders predate selectable terms and were quoted
    // with their entire freight payable at confirmation. Preserve that contract.
    if (Number(plan.payment_terms_version ?? 0) === 0 && Number(plan.preorder_amount_cents) === 0) return Number(order.total);
    return coverage.due_on_confirmation_cents;
  }
  if (stage !== 'balance' || !coverage.initial_payment_covered) fail(409,'A entrada precisa estar confirmada.');
  return coverage.outstanding_cents;
}
async function createCharge(pool, {orderId,customer,body,adapter,collectorId}) {
  if (!customer?.id || !body || !['initial','balance'].includes(body.stage) || !UUID.test(body.idempotency_key || '')) fail(400,'Solicitação de pagamento inválida.');
  const charge = await transaction(pool,async c=>{
    const order = await ownOrder(c,orderId,customer.id);
    const [existing] = await c.query('SELECT * FROM print3d_payment_charges WHERE order_id=? ORDER BY created_at,id FOR UPDATE',[orderId]);
    const replay = existing.find(r=>r.idempotency_key === body.idempotency_key.toLowerCase());
    if (replay && replay.stage !== body.stage) fail(409,'Identificador usado em outra etapa.');
    if (replay) return replay;
    const active = existing.find(r=>r.stage === body.stage && !['cancelled','rejected'].includes(r.status));
    if (active) return active;
    const coverage = await readCoverage(c,orderId);
    const [plans] = await c.query('SELECT * FROM print3d_order_plans WHERE order_id=? LIMIT 1 FOR UPDATE',[orderId]);
    const amount = stageAmount(body.stage,plans[0],coverage,order);
    if (body.stage === 'balance') {
      const [unfinished] = await c.query(`SELECT p.order_item_id FROM print3d_order_item_plans p LEFT JOIN print3d_production_jobs j ON j.order_item_id=p.order_item_id
        WHERE p.order_id=? AND p.preorder_quantity>0 AND (j.id IS NULL OR j.status<>'completed' OR j.approved_quantity<p.preorder_quantity)`,[orderId]);
      if (unfinished.length) fail(409,'O saldo será liberado quando a produção estiver concluída.');
    }
    const email = String(body.payer_email || customer.email || order.customer_email || '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) fail(400,'Informe um e-mail válido para emitir o PIX.');
    const row = {id:crypto.randomUUID(),order_id:orderId,stage:body.stage,idempotency_key:body.idempotency_key.toLowerCase(),amount_cents:amount,payer_email:email,status:'creating'};
    await c.query('INSERT INTO print3d_payment_charges (id,order_id,stage,idempotency_key,amount_cents,payer_email,status) VALUES (?,?,?,?,?,?,?)',Object.values(row));
    return row;
  });
  // The durable intent and stable provider idempotency key survive a timeout/crash.
  // Repeated requests never invent a new key while a charge is unresolved.
  const payment = charge.provider_payment_id ? await adapter.get(charge.provider_payment_id) : await adapter.create(charge);
  return settlePayment(pool,{payment,chargeId:charge.id,collectorId});
}
async function settlePayment(pool,{payment,chargeId,collectorId}) {
  return transaction(pool,async (c,orderId)=>{
    const order = await ownOrder(c,orderId,null,true);
    const [rows] = await c.query('SELECT * FROM print3d_payment_charges WHERE id=? FOR UPDATE',[chargeId]);
    const charge = rows[0];
    verifyPayment(payment,charge,collectorId);
    // A settled refund is terminal. Authenticate the same provider reference
    // before acknowledging retries (including stale approval notifications).
    // Creation/refresh still use the strict order guard before external I/O.
    if (order.payment_status === 'refunded') return {charge:publicCharge({...charge,status:'refunded'}),review_required:true};
    // Never resurrect a locally cancelled order. A delayed provider approval is
    // retained for refund review, but does not create a receipt or unlock work.
    if (order.status === 'cancelled') {
      // A full, verified provider refund resolves this charge only. Other
      // charges on the same cancelled order may still need reconciliation.
      if (charge.status === 'refunded') return {charge:publicCharge(charge),review_required:false};
      if (payment.status === 'refunded'
        && moneyCents(payment.transaction_amount_refunded) === Number(charge.amount_cents)) {
        await c.query("UPDATE print3d_payment_charges SET status='refunded',provider_payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[String(payment.id),charge.id]);
        return {charge:publicCharge({...charge,status:'refunded'}),review_required:false};
      }
      // Late approvals cannot be erased by stale pending/cancelled snapshots.
      if (charge.status === 'late_payment' && payment.status !== 'approved') {
        await c.query('UPDATE print3d_payment_charges SET updated_at=CURRENT_TIMESTAMP WHERE id=?',[charge.id]);
        return {charge:publicCharge(charge),review_required:true};
      }
      if (payment.status === 'approved') {
        const approvedAt = new Date(payment.date_approved);
        if (!payment.date_approved || !Number.isFinite(approvedAt.valueOf())) fail(409,'Pagamento sem data de liquidação.');
        await recordLatePrint3dPaymentOnConnection(c,{orderId:charge.order_id,chargeId:charge.id,providerPaymentId:payment.id,
          amountCents:Number(charge.amount_cents),occurredAt:approvedAt});
        await c.query("UPDATE print3d_payment_charges SET status='late_payment',provider_payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          [String(payment.id),charge.id]);
        return {charge:publicCharge({...charge,status:'late_payment'}),review_required:true,late_payment:true};
      }
      if (['cancelled','rejected'].includes(payment.status)) {
        await c.query("UPDATE print3d_payment_charges SET status='provider_cancelled',provider_payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[String(payment.id),charge.id]);
        return {charge:publicCharge({...charge,status:'provider_cancelled'}),review_required:false};
      }
      // Creation may finish after local cancellation. Keep the verified remote
      // identity so the cancellation worker can find and close this PIX later.
      // Preserve terminal local state if this is a stale provider snapshot.
      await c.query('UPDATE print3d_payment_charges SET provider_payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[String(payment.id),charge.id]);
      return {charge:publicCharge({...charge,status:'cancelled'}),review_required:true};
    }
    // A refund/chargeback blocks production/dispatch rather than being silently ignored.
    if (['refunded','charged_back'].includes(payment.status) || Number(payment.transaction_amount_refunded || 0) > 0) {
      await c.query("UPDATE orders SET payment_status='refunded',updated_at=CURRENT_TIMESTAMP WHERE id=?",[charge.order_id]);
      await c.query("UPDATE print3d_payment_charges SET status='refunded',provider_payment_id=? WHERE id=?",[String(payment.id),charge.id]);
      return {charge:publicCharge({...charge,status:'refunded'}),review_required:true};
    }
    let coverage = await readCoverage(c,charge.order_id);
    if (payment.status === 'approved') {
      const date = new Date(payment.date_approved);
      if (!payment.date_approved || !Number.isFinite(date.valueOf())) fail(409,'Pagamento sem data de liquidação.');
      const receipt = await recordReceipt(c,{orderId:charge.order_id,eventKey:`mp:${payment.id}:approved`,provider:'mercadopago_3d',
        providerPaymentId:String(payment.id),amountCents:Number(charge.amount_cents),confirmedAt:date.toISOString()});
      coverage = receipt.coverage;
      if (coverage.initial_payment_covered) await releaseJobs(c,{orderId:charge.order_id});
      if (coverage.fully_paid) await c.query("UPDATE orders SET payment_status='paid',updated_at=CURRENT_TIMESTAMP WHERE id=?",[charge.order_id]);
    }
    // A stale pending snapshot cannot downgrade a receipt already settled by webhook.
    const status = charge.status === 'approved' ? 'approved' : payment.status === 'in_process' ? 'pending' : payment.status;
    const pix = payment.point_of_interaction?.transaction_data || {};
    const row = {...charge,status,provider_payment_id:String(payment.id),pix_code:String(pix.qr_code || '').slice(0,8192),
      pix_qr_base64:String(pix.qr_code_base64 || '').slice(0,500000),expires_at:payment.date_of_expiration || null};
    await c.query('UPDATE print3d_payment_charges SET status=?,provider_payment_id=?,pix_code=?,pix_qr_base64=?,expires_at=? WHERE id=?',
      [row.status,row.provider_payment_id,row.pix_code,row.pix_qr_base64,row.expires_at,row.id]);
    return {charge:publicCharge(row),coverage};
  },async c=>{
    // Read the immutable reference before BEGIN. A consistent read inside the
    // transaction would pin an old snapshot before waiting for the order lock,
    // hiding receipts committed by the preceding notification.
    const [refs] = await c.query('SELECT order_id FROM print3d_payment_charges WHERE id=?',[chargeId]);
    if (!refs[0]) fail(404,'Cobrança não encontrada.');
    return refs[0].order_id;
  });
}
async function listCharges(pool,{orderId,customerId}) {
  return transaction(pool,async c=>{
    await ownOrder(c,orderId,customerId);
    const [rows] = await c.query('SELECT * FROM print3d_payment_charges WHERE order_id=? ORDER BY created_at,id',[orderId]);
    return {charges:rows.map(publicCharge),coverage:await readCoverage(c,orderId)};
  });
}
async function refreshCharge(pool,{orderId,customerId,chargeId,adapter,collectorId}) {
  const charge = await transaction(pool,async c=>{
    await ownOrder(c,orderId,customerId);
    const [rows] = await c.query('SELECT * FROM print3d_payment_charges WHERE id=? AND order_id=?',[chargeId,orderId]);
    if (!rows[0]) fail(404,'Cobrança não encontrada.'); return rows[0];
  });
  const payment = charge.provider_payment_id ? await adapter.get(charge.provider_payment_id) : await adapter.create(charge);
  return settlePayment(pool,{payment,chargeId:charge.id,collectorId});
}
// Runs only after the order was already cancelled and its local reservation was
// released.  A gateway race is reconciled through settlePayment: an approval is
// recorded as late_payment and never resurrects the order or its production.
async function cancelPrint3dProviderCharges(pool,{orderId,adapter,collectorId}) {
  if (!UUID.test(orderId || '') || !adapter?.get || !adapter?.cancel) fail(400,'Solicitação de cancelamento inválida.');
  const [charges] = await pool.query(`SELECT * FROM print3d_payment_charges
    WHERE order_id=? AND status NOT IN ('provider_cancelled','refunded')
      AND EXISTS (SELECT 1 FROM orders o WHERE o.id=print3d_payment_charges.order_id
        AND o.storefront='loja_3d' AND o.status='cancelled' AND o.customer_id IS NULL
        AND o.print3d_customer_id IS NOT NULL) ORDER BY created_at,id`,[orderId]);
  const outcomes=[];
  for (const charge of charges) {
    try {
      let providerId=charge.provider_payment_id;
      if (!providerId) {
        // Search is read-only: never recreate a PIX for a cancelled order.
        const found=await adapter.findByReference?.(charge.id);
        if (!found) fail(409,'PIX ainda não localizado; requer nova conferência.');
        verifyPayment(found,charge,collectorId);
        providerId=String(found.id);
      }
      const current=await adapter.get(providerId);
      verifyPayment(current,{...charge,provider_payment_id:providerId},collectorId);
      const payment=charge.status !== 'late_payment' && ['pending','in_process','authorized'].includes(current.status) ? await adapter.cancel(providerId) : current;
      verifyPayment(payment,{...charge,provider_payment_id:providerId},collectorId);
      const settled=await settlePayment(pool,{payment,chargeId:charge.id,collectorId});
      if (settled.review_required) await pool.query("UPDATE print3d_payment_charges SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('cancelled','late_payment')",[charge.id]);
      outcomes.push({charge_id:charge.id,status:payment.status,review_required:Boolean(settled.review_required)});
    } catch (error) {
      // The order stays cancelled locally. Do not disclose provider data to the
      // customer, and leave the event for administrative reconciliation.
      await pool.query("UPDATE print3d_payment_charges SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('cancelled','late_payment')",[charge.id]);
      outcomes.push({charge_id:charge.id,status:'review_required'});
    }
  }
  return outcomes;
}
module.exports = {paymentsConfigured,publicCharge,moneyCents,verifyPayment,verifyWebhook,createMpAdapter,stageAmount,createCharge,settlePayment,listCharges,refreshCharge,cancelPrint3dProviderCharges};
