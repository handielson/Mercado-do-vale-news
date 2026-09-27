'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { readPrint3dPaymentCoverageOnConnection } = require('./print3dOrderPlan.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status, message) { throw Object.assign(new Error(message), { statusCode: status }); }
function validateProgress(body) {
  if (!body || typeof body !== 'object' || !UUID.test(body.idempotency_key || '')) fail(400, 'Identificador único do lançamento inválido.');
  const approved = body.approved_quantity, rejected = body.rejected_quantity ?? 0;
  if (![approved, rejected].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000) || approved + rejected === 0) fail(400, 'Informe quantidades inteiras e pelo menos uma unidade.');
  if (body.note != null && (typeof body.note !== 'string' || body.note.length > 2000)) fail(400, 'Observação inválida (máximo 2000 caracteres).');
  const value = { approved_quantity: approved, rejected_quantity: rejected, note: (body.note || '').trim() };
  return { ...value, idempotency_key: body.idempotency_key.toLowerCase(), payload_hash: createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}
function projectJob(row, events = [], admin = false) {
  const job = {};
  for (const key of ['id','order_id','order_number','order_item_id','product_name','sku','status']) job[key] = row[key];
  job.target_quantity = Number(row.target_quantity);
  job.approved_quantity = Number(row.approved_quantity);
  job.history = events.filter(e => admin || Number(e.approved_quantity) > 0).map(e => ({
    id: e.id, approved_quantity: Number(e.approved_quantity), created_at: e.created_at,
    ...(admin ? { rejected_quantity: Number(e.rejected_quantity), note: e.note || '', actor_id: e.actor_id } : {}),
  }));
  if (admin) {
    job.rejected_quantity = Number(row.rejected_quantity);
    job.recipe_id = row.recipe_id;
    job.primary_file_id = row.primary_file_id;
  }
  return job;
}
async function readJob(connection, id, admin, customerId) {
  const [rows] = await connection.query(
    `SELECT j.*,CASE WHEN o.status='cancelled' OR o.payment_status='refunded' THEN 'cancelled' ELSE j.status END AS status FROM print3d_production_jobs j JOIN orders o ON o.id=j.order_id
     WHERE j.id=? AND o.storefront='loja_3d' AND o.customer_id IS NULL ${customerId ? 'AND o.print3d_customer_id=?' : ''}`,
    customerId ? [id, customerId] : [id]);
  if (!rows[0]) fail(404, 'Produção não encontrada.');
  const [events] = await connection.query('SELECT * FROM print3d_production_events WHERE job_id=? ORDER BY created_at,id', [id]);
  return projectJob(rows[0], events, admin);
}
async function listProductionJobs(connection, { customerId, admin = false } = {}) {
  if (!admin && !customerId) fail(401, 'Sessão de cliente necessária.');
  const [rows] = await connection.query(
    `SELECT j.*,CASE WHEN o.status='cancelled' OR o.payment_status='refunded' THEN 'cancelled' ELSE j.status END AS status FROM print3d_production_jobs j JOIN orders o ON o.id=j.order_id
     WHERE o.storefront='loja_3d' AND o.customer_id IS NULL ${admin ? '' : 'AND o.print3d_customer_id=?'}
     ORDER BY j.created_at DESC,j.id DESC LIMIT 200`, admin ? [] : [customerId]);
  if (!rows.length) return [];
  const [events] = await connection.query(
    `SELECT * FROM print3d_production_events WHERE job_id IN (${rows.map(() => '?').join(',')}) ORDER BY created_at,id`, rows.map(r => r.id));
  return rows.map(r => projectJob(r, events.filter(e => e.job_id === r.id), admin));
}
async function recordProductionProgress(pool, { jobId, actorId, body }) {
  if (!UUID.test(jobId || '') || !actorId) fail(400, 'Lançamento inválido.');
  const input = validateProgress(body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Lock the order first: cancellation/payment transitions must use this same lock.
    const [refs] = await connection.query('SELECT order_id FROM print3d_production_jobs WHERE id=?', [jobId]);
    if (!refs[0]) fail(404, 'Produção não encontrada.');
    const order = await lockOrder(connection, refs[0].order_id);
    const [rows] = await connection.query('SELECT * FROM print3d_production_jobs WHERE id=? FOR UPDATE', [jobId]);
    const job = rows[0];
    if (!job) fail(404, 'Produção não encontrada.');
    const [existing] = await connection.query('SELECT * FROM print3d_production_events WHERE job_id=? AND idempotency_key=?', [jobId, input.idempotency_key]);
    if (existing[0]) {
      if (existing[0].payload_hash !== input.payload_hash) fail(409, 'Este lançamento já foi usado com outros valores.');
      const result = await readJob(connection, jobId, true);
      await connection.commit();
      return { job: result, replayed: true };
    }
    if (order.status === 'cancelled' || order.payment_status === 'refunded' || !['queued','in_progress'].includes(job.status)) fail(409, 'Esta produção não está liberada para apontamentos.');
    const coverage = await readPrint3dPaymentCoverageOnConnection(connection, job.order_id);
    if (!coverage.initial_payment_covered || coverage.due_on_confirmation_cents <= 0) fail(409, 'A entrada ainda não foi confirmada.');
    const approved = Number(job.approved_quantity) + input.approved_quantity;
    const rejected = Number(job.rejected_quantity) + input.rejected_quantity;
    if (approved > Number(job.target_quantity) || rejected > 2147483647) fail(409, 'Quantidade excede o limite da produção.');
    await connection.query(
      'INSERT INTO print3d_production_events (id,job_id,idempotency_key,payload_hash,approved_quantity,rejected_quantity,note,actor_id) VALUES (?,?,?,?,?,?,?,?)',
      [randomUUID(),jobId,input.idempotency_key,input.payload_hash,input.approved_quantity,input.rejected_quantity,input.note,String(actorId)]);
    await connection.query('UPDATE print3d_production_jobs SET approved_quantity=?,rejected_quantity=?,status=? WHERE id=?',
      [approved,rejected,approved === Number(job.target_quantity) ? 'completed' : 'in_progress',jobId]);
    const result = await readJob(connection, jobId, true);
    await connection.commit();
    return { job: result, replayed: false };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function lockOrder(connection, orderId) {
  if (!UUID.test(orderId || '')) fail(400, 'Pedido inválido.');
  const [rows] = await connection.query('SELECT * FROM orders WHERE id=? FOR UPDATE', [orderId]);
  if (!rows[0] || rows[0].storefront !== 'loja_3d' || !rows[0].print3d_customer_id || rows[0].customer_id) fail(404, 'Pedido 3D identificado não encontrado.');
  return rows[0];
}
// INTERNAL ONLY. Caller owns transaction. Snapshot comes from the checkout plan,
// never from current stock or an admin supplied production quantity.
async function createProductionJobsOnConnection(connection, { orderId }) {
  const order = await lockOrder(connection, orderId);
  if (order.status === 'cancelled' || order.payment_status === 'refunded') fail(409, 'Pedido cancelado ou estornado.');
  const [plans] = await connection.query('SELECT * FROM print3d_order_plans WHERE order_id=? FOR UPDATE', [orderId]);
  if (!plans[0]) fail(409, 'Plano de encomenda ainda não registrado.');
  const [items] = await connection.query(
    `SELECT p.*,i.product_name,i.product_sku,a.recipe_id,a.primary_file_id
     FROM print3d_order_item_plans p JOIN order_items i ON i.id=p.order_item_id AND i.order_id=p.order_id
     LEFT JOIN print3d_active_recipes a ON a.product_id=p.product_id
     WHERE p.order_id=? AND p.preorder_quantity>0`, [orderId]);
  for (const item of items) {
    const [existing] = await connection.query('SELECT id FROM print3d_production_jobs WHERE order_item_id=?', [item.order_item_id]);
    if (existing.length) continue;
    if (!item.recipe_id || !item.primary_file_id) fail(409, 'Selecione a ficha e o arquivo de impressão antes de gerar a produção.');
    await connection.query(
      `INSERT INTO print3d_production_jobs (id,order_id,order_number,order_item_id,product_id,product_name,sku,target_quantity,recipe_id,primary_file_id,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'awaiting_payment')`,
      [randomUUID(),orderId,'3D-' + String(plans[0].public_number),item.order_item_id,item.product_id,item.product_name,item.product_sku || '',Number(item.preorder_quantity),item.recipe_id,item.primary_file_id]);
  }
}
// INTERNAL ONLY. Called after verified gateway receipt persistence, in the SAME
// transaction. A legacy orders.payment_status='paid' is deliberately insufficient.
async function releaseProductionJobsOnConnection(connection, { orderId }) {
  const order = await lockOrder(connection, orderId);
  if (order.status === 'cancelled' || order.payment_status === 'refunded') fail(409, 'Pedido cancelado ou estornado.');
  const coverage = await readPrint3dPaymentCoverageOnConnection(connection, orderId);
  if (!coverage.initial_payment_covered || coverage.due_on_confirmation_cents <= 0) fail(409, 'A entrada ainda não foi confirmada.');
  const [result] = await connection.query("UPDATE print3d_production_jobs SET status='queued' WHERE order_id=? AND status='awaiting_payment'", [orderId]);
  return { released: Number(result.affectedRows || 0) };
}
module.exports = { UUID,validateProgress,projectJob,listProductionJobs,recordProductionProgress,createProductionJobsOnConnection,releaseProductionJobsOnConnection };
