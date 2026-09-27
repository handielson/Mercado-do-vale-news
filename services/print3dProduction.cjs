'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { normalizeVariantSnapshot } = require('./print3dStorefrontQuote.cjs');
const { readPrint3dPaymentCoverageOnConnection } = require('./print3dOrderPlan.cjs');
const { FILAMENT_ID,gramsToMillis,consumePrint3dFilamentsOnConnection } = require('./print3dMaterialStock.cjs');
const { unitsToMicros,consumePrint3dSuppliesOnConnection } = require('./print3dSupplyStock.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(status, message) { throw Object.assign(new Error(message), { statusCode: status }); }
function validateProgress(body) {
  if (!body || typeof body !== 'object' || !UUID.test(body.idempotency_key || '')) fail(400, 'Identificador único do lançamento inválido.');
  const approved = body.approved_quantity, rejected = body.rejected_quantity ?? 0;
  if (![approved, rejected].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000) || approved + rejected === 0) fail(400, 'Informe quantidades inteiras e pelo menos uma unidade.');
  const material = body.material_consumed_grams;
  const totalMillis = gramsToMillis(material);
  if (totalMillis === null) {
    fail(400, 'Informe o material realmente consumido em gramas, com até três casas decimais.');
  }
  if (!Array.isArray(body.filaments) || !body.filaments.length || body.filaments.length > 20) fail(400, 'Distribua o consumo entre os filamentos da ficha.');
  const filaments = body.filaments.map(item => {
    const filament_id = String(item?.filament_id || '');
    const grams_millis = gramsToMillis(item?.consumed_grams);
    if (!FILAMENT_ID.test(filament_id) || grams_millis === null) fail(400, 'Filamento ou consumo em gramas inválido.');
    return { filament_id, grams_millis };
  });
  if (new Set(filaments.map(item => item.filament_id)).size !== filaments.length || filaments.reduce((sum,item) => sum + item.grams_millis, 0) !== totalMillis) {
    fail(400, 'A soma dos filamentos deve corresponder ao material realmente consumido.');
  }
  const supplyInput = body.supplies ?? [];
  if (!Array.isArray(supplyInput) || supplyInput.length > 30) fail(400,'Informe os insumos da ficha.');
  const supplies = supplyInput.map(item => {
    const supply_id = String(item?.supply_id || '');
    const quantity_micros = unitsToMicros(item?.consumed_quantity);
    if (!FILAMENT_ID.test(supply_id) || quantity_micros === null) fail(400,'Insumo ou quantidade consumida inválida.');
    return {supply_id,quantity_micros};
  });
  if (new Set(supplies.map(item => item.supply_id)).size !== supplies.length) fail(400,'Insumo duplicado no apontamento.');
  if (body.note != null && (typeof body.note !== 'string' || body.note.length > 2000)) fail(400, 'Observação inválida (máximo 2000 caracteres).');
  const value = { approved_quantity: approved, rejected_quantity: rejected, material_consumed_grams: material, note: (body.note || '').trim(),
    filaments: [...filaments].sort((a,b) => a.filament_id.localeCompare(b.filament_id, 'en')),
    supplies: [...supplies].sort((a,b) => a.supply_id.localeCompare(b.supply_id,'en')) };
  return { ...value, idempotency_key: body.idempotency_key.toLowerCase(), payload_hash: createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}
function projectJob(row, events = [], outputs = [], admin = false, recipe = {}, pinnedFile = null) {
  const job = {};
  for (const key of ['id','order_id','order_number','order_item_id','product_name','sku','status']) job[key] = row[key];
  job.target_quantity = Number(row.target_quantity);
  job.variant_snapshot = normalizeVariantSnapshot(row.variant_snapshot);
  job.approved_quantity = Number(row.approved_quantity);
  job.reserved_for_order_quantity = outputs
    .filter(output => output.status === 'reserved_for_order')
    .reduce((total, output) => total + Number(output.quantity || 0), 0);
  job.history = events.filter(e => admin || Number(e.approved_quantity) > 0).map(e => ({
    id: e.id, approved_quantity: Number(e.approved_quantity), created_at: e.created_at,
    ...(admin ? { rejected_quantity: Number(e.rejected_quantity), material_consumed_grams: Number(e.material_consumed_grams || 0), note: e.note || '', actor_id: e.actor_id } : {}),
  }));
  if (admin) {
    job.rejected_quantity = Number(row.rejected_quantity);
    job.recipe_id = row.recipe_id;
    job.primary_file_id = row.primary_file_id;
    job.filaments = recipe.filaments || [];
    job.supplies = recipe.supplies || [];
    job.recipe_summary = recipe.summary || null;
    job.primary_file = pinnedFile;
    job.dispatched_quantity = outputs
      .filter(output => output.status === 'dispatched')
      .reduce((total, output) => total + Number(output.quantity || 0), 0);
    job.material_consumed_grams = events.reduce((total, event) => total + Number(event.material_consumed_grams || 0), 0);
  }
  return job;
}
async function readRecipeFilaments(connection, recipeIds) {
  if (!recipeIds.length) return new Map();
  const ids = [...new Set(recipeIds)];
  const [rows] = await connection.query(`SELECT id,draft_json FROM print3d_recipe_revisions WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  return new Map(rows.map(row => {
    const draft = typeof row.draft_json === 'string' ? JSON.parse(row.draft_json) : row.draft_json;
    const filaments = Array.isArray(draft?.filaments) ? draft.filaments.map(item => ({ id:item.id,name:item.name,color:item.color,estimated_grams_per_batch:Number(item.consumedGrams) })) : [];
    const supplies = Array.isArray(draft?.supplies) ? draft.supplies.map(item => ({ id:item.id,name:item.name,
      unit_label:item.unitLabel || 'un',estimated_quantity_per_batch:Number(item.quantity) })) : [];
    return [row.id,{ productId:draft?.productId, sku:draft?.sku, filaments,supplies,
      summary:{pieces_per_batch:Number(draft?.piecesPerBatch),material_gramas:Number(draft?.printSummary?.material_gramas),
        tempo_impressao_minutos:Number(draft?.printSummary?.tempo_impressao_minutos)} }];
  }));
}
async function readPinnedFiles(connection,jobs) {
  if (!jobs.length) return new Map();
  const [rows] = await connection.query(`SELECT j.id AS job_id,j.recipe_id,j.primary_file_id,
    r.product_id AS recipe_product_id,r.sku_snapshot,r.revision,
    f.id AS file_id,f.recipe_id AS file_recipe_id,f.kind,f.original_name,f.printer_profile,f.sha256,f.byte_size
    FROM print3d_production_jobs j
    LEFT JOIN print3d_recipe_revisions r ON r.id=j.recipe_id
    LEFT JOIN print3d_recipe_files f ON f.id=j.primary_file_id
    WHERE j.id IN (${jobs.map(() => '?').join(',')})`,jobs.map(job => job.id));
  const byJob=new Map(jobs.map(job => [job.id,job]));
  return new Map(rows.map(row => {
    const job=byJob.get(row.job_id);
    const valid=job && row.recipe_id===job.recipe_id && row.primary_file_id===job.primary_file_id
      && row.recipe_product_id===job.product_id && row.sku_snapshot===job.sku
      && row.file_id===job.primary_file_id && row.file_recipe_id===job.recipe_id
      && ['model','project','gcode'].includes(row.kind) && (row.kind!=='gcode' || row.printer_profile);
    return [row.job_id,valid?{id:row.file_id,revision:row.revision,kind:row.kind,original_name:row.original_name,
      printer_profile:row.printer_profile || null,sha256:row.sha256,byte_size:Number(row.byte_size)}:null];
  }));
}
async function readOutputSummaries(connection, jobIds) {
  if (!jobIds.length) return [];
  const [rows] = await connection.query(
    `SELECT job_id,status,COALESCE(SUM(quantity),0) AS quantity
       FROM print3d_production_outputs
      WHERE job_id IN (${jobIds.map(() => '?').join(',')})
      GROUP BY job_id,status`, jobIds);
  return rows;
}
async function readJob(connection, id, admin, customerId) {
  const [rows] = await connection.query(
    `SELECT j.*,ip.variant_snapshot,CASE WHEN o.status='cancelled' OR o.payment_status='refunded' THEN 'cancelled' ELSE j.status END AS status FROM print3d_production_jobs j JOIN orders o ON o.id=j.order_id
     LEFT JOIN print3d_order_item_plans ip ON ip.order_item_id=j.order_item_id AND ip.order_id=j.order_id
     WHERE j.id=? AND o.storefront='loja_3d' AND o.customer_id IS NULL ${customerId ? 'AND o.print3d_customer_id=?' : ''}`,
    customerId ? [id, customerId] : [id]);
  if (!rows[0]) fail(404, 'Produção não encontrada.');
  const [events] = await connection.query('SELECT * FROM print3d_production_events WHERE job_id=? ORDER BY created_at,id', [id]);
  const outputs = await readOutputSummaries(connection, [id]);
  const recipes = admin ? await readRecipeFilaments(connection, [rows[0].recipe_id]) : new Map();
  const files = admin ? await readPinnedFiles(connection,rows) : new Map();
  return projectJob(rows[0], events, outputs, admin, recipes.get(rows[0].recipe_id),files.get(id));
}
async function listProductionJobs(connection, { customerId, admin = false } = {}) {
  if (!admin && !customerId) fail(401, 'Sessão de cliente necessária.');
  const [rows] = await connection.query(
    `SELECT j.*,ip.variant_snapshot,CASE WHEN o.status='cancelled' OR o.payment_status='refunded' THEN 'cancelled' ELSE j.status END AS status FROM print3d_production_jobs j JOIN orders o ON o.id=j.order_id
     LEFT JOIN print3d_order_item_plans ip ON ip.order_item_id=j.order_item_id AND ip.order_id=j.order_id
     WHERE o.storefront='loja_3d' AND o.customer_id IS NULL ${admin ? '' : 'AND o.print3d_customer_id=?'}
     ORDER BY j.created_at DESC,j.id DESC LIMIT 200`, admin ? [] : [customerId]);
  if (!rows.length) return [];
  const [events] = await connection.query(
    `SELECT * FROM print3d_production_events WHERE job_id IN (${rows.map(() => '?').join(',')}) ORDER BY created_at,id`, rows.map(r => r.id));
  const outputs = await readOutputSummaries(connection, rows.map(row => row.id));
  const recipes = admin ? await readRecipeFilaments(connection, rows.map(row => row.recipe_id)) : new Map();
  const files = admin ? await readPinnedFiles(connection,rows) : new Map();
  return rows.map(r => projectJob(r, events.filter(e => e.job_id === r.id), outputs.filter(output => output.job_id === r.id), admin, recipes.get(r.recipe_id),files.get(r.id)));
}
async function recordProductionProgress(pool, { jobId, actorId, body }) {
  if (!UUID.test(jobId || '') || !actorId) fail(400, 'Lançamento inválido.');
  const input = validateProgress(body);
  const connection = await pool.getConnection();
  try {
    // Read the immutable order reference before opening the transaction. A plain
    // read inside REPEATABLE READ would pin a stale snapshot before waiting for
    // the order lock, hiding a concurrently committed idempotency event.
    const [refs] = await connection.query('SELECT order_id FROM print3d_production_jobs WHERE id=?', [jobId]);
    if (!refs[0]) fail(404, 'Produção não encontrada.');
    await connection.beginTransaction();
    // Lock the order first: cancellation/payment transitions must use this same lock.
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
    const recipe = (await readRecipeFilaments(connection, [job.recipe_id])).get(job.recipe_id);
    if (!recipe || recipe.productId !== job.product_id || recipe.sku !== job.sku || !recipe.filaments.length) fail(409, 'A ficha imutável desta produção não confere com o produto.');
    const validIds = new Set(recipe.filaments.map(item => item.id));
    if (input.filaments.some(item => !validIds.has(item.filament_id))) fail(409, 'Selecione somente filamentos da ficha desta produção.');
    const supplyIds = new Set(recipe.supplies.map(item => item.id));
    if (supplyIds.size !== recipe.supplies.length || input.supplies.length !== supplyIds.size
      || input.supplies.some(item => !supplyIds.has(item.supply_id))) fail(409,'Informe o consumo real de todos os insumos da ficha.');
    const productionEventId = randomUUID();
    await connection.query(
      'INSERT INTO print3d_production_events (id,job_id,idempotency_key,payload_hash,approved_quantity,rejected_quantity,material_consumed_grams,note,actor_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [productionEventId,jobId,input.idempotency_key,input.payload_hash,input.approved_quantity,input.rejected_quantity,input.material_consumed_grams,input.note,String(actorId)]);
    await consumePrint3dFilamentsOnConnection(connection, { allocations:input.filaments,productionEventId,actorId });
    await consumePrint3dSuppliesOnConnection(connection,{allocations:input.supplies,productionEventId,actorId,recipeSupplies:recipe.supplies});
    if (input.approved_quantity > 0) {
      await connection.query(
        `INSERT INTO print3d_production_outputs (id,job_id,production_event_id,order_id,order_item_id,product_id,quantity,status)
         VALUES (?,?,?,?,?,?,?,'reserved_for_order')`,
        [randomUUID(),jobId,productionEventId,job.order_id,job.order_item_id,job.product_id,input.approved_quantity]);
    }
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
    `SELECT p.*,i.product_name,i.product_sku,a.recipe_id,a.primary_file_id,
      r.sku_snapshot AS recipe_sku,f.kind AS primary_file_kind,f.printer_profile AS primary_printer_profile
     FROM print3d_order_item_plans p JOIN order_items i ON i.id=p.order_item_id AND i.order_id=p.order_id
     LEFT JOIN print3d_active_recipes a ON a.product_id=p.product_id
     LEFT JOIN print3d_recipe_revisions r ON r.id=a.recipe_id AND r.product_id=p.product_id
     LEFT JOIN print3d_recipe_files f ON f.id=a.primary_file_id AND f.recipe_id=a.recipe_id
     WHERE p.order_id=? AND p.preorder_quantity>0`, [orderId]);
  for (const item of items) {
    const [existing] = await connection.query('SELECT id FROM print3d_production_jobs WHERE order_item_id=?', [item.order_item_id]);
    if (existing.length) continue;
    if (!item.recipe_id || !item.primary_file_id) fail(409, 'Selecione a ficha e o arquivo de impressão antes de gerar a produção.');
    if (item.recipe_sku !== item.product_sku || !['model','project','gcode'].includes(item.primary_file_kind)
      || (item.primary_file_kind === 'gcode' && !item.primary_printer_profile)) {
      fail(409,'A ficha ou o arquivo principal não correspondem ao SKU atual. Selecione uma revisão válida antes da encomenda.');
    }
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
module.exports = { UUID,validateProgress,projectJob,listProductionJobs,recordProductionProgress,createProductionJobsOnConnection,releaseProductionJobsOnConnection,readOutputSummaries,readRecipeFilaments,readPinnedFiles };
