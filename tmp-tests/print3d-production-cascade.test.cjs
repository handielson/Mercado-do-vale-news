'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { quoteProduct } = require('../services/print3dStorefrontQuote.cjs');
const { savePrint3dOrderPlanOnConnection, recordVerifiedPrint3dPaymentOnConnection,
  readPrint3dPaymentCoverageOnConnection } = require('../services/print3dOrderPlan.cjs');
const { createProductionJobsOnConnection, releaseProductionJobsOnConnection,
  recordProductionProgress, listProductionJobs } = require('../services/print3dProduction.cjs');

// Banco em memória compartilhado por TODOS os módulos da cascata. Os helpers
// reais emitem SQL; o fake preserva planos/recebimentos/jobs e desfaz a transação
// inteira na falha. SQL não reconhecido falha, inclusive qualquer escrita de
// estoque, pedido, gateway ou comunicação externa.
function localDatabase(readyQuantity = 0) {
  const orderId = randomUUID(), itemId = randomUUID(), productId = randomUUID(), customerId = randomUUID();
  const quote = quoteProduct({ id: productId, price_retail: 100, available_stock: readyQuantity,
    print3d_preorder_enabled: 1, production_days: 5 }, 100);
  // A cascata começa depois que a consulta de prazo foi aprovada e virou pedido.
  quote.status = 'available';
  const data = {
    orders: [{ id: orderId, storefront: 'loja_3d', print3d_customer_id: customerId, customer_id: null,
      status: 'pending', payment_status: 'pending', subtotal: 10000, shipping_cost: 500, total: 10500, discount: 0 }],
    items: [{ id: itemId, order_id: orderId, product_id: productId, product_name: 'Chaveiro 3D',
      product_sku: 'CH-01', quantity: 100, unit_price: 100, subtotal: 10000 }],
    recipes: [{ product_id: productId, recipe_id: randomUUID(), primary_file_id: randomUUID() }],
    plans: [], itemPlans: [], receipts: [], jobs: [], events: [], outputs: [], movements: [], stock: { 'filament-pla':1000 },
  };
  const audit = { queries: [], commits: 0, rollbacks: 0 };
  let transactionActive = false;
  const query = async (rawSql, args = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    audit.queries.push(sql);
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) assert.equal(transactionActive, true, 'Mutação exige transação do chamador');
    const rows = value => [structuredClone(value)];
    if (sql.startsWith('SELECT * FROM orders WHERE id=')) return rows(data.orders.filter(order => order.id === args[0]));
    if (sql.startsWith('SELECT * FROM order_items WHERE order_id=')) return rows(data.items.filter(item => item.order_id === args[0]));
    if (sql.startsWith('SELECT * FROM print3d_order_plans WHERE order_id=')) return rows(data.plans.filter(plan => plan.order_id === args[0]));
    if (sql.startsWith('INSERT INTO print3d_order_plans') || sql.startsWith('INSERT INTO print3d_order_item_plans')) {
      const table = sql.startsWith('INSERT INTO print3d_order_plans') ? data.plans : data.itemPlans;
      const columns = sql.match(/\(([^)]+)\)/)[1].split(',');
      const row = Object.fromEntries(columns.map((column, index) => [column, args[index]]));
      if (table === data.plans) row.public_number = 1 + data.plans.length;
      table.push(row);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SUM(amount_cents)')) return rows([{ confirmed_cents: data.receipts
      .filter(receipt => receipt.order_id === args[0] && receipt.status === 'confirmed')
      .reduce((sum, receipt) => sum + receipt.amount_cents, 0) }]);
    if (sql.startsWith('SELECT id,draft_json FROM print3d_recipe_revisions')) return rows(data.jobs.filter(job => args.includes(job.recipe_id)).map(job => ({ id:job.recipe_id,draft_json:{productId:job.product_id,sku:job.sku,filaments:[{id:'filament-pla',name:'PLA',color:'Preto',consumedGrams:35.5}]}})));
    if (sql.startsWith('SELECT quantity_grams FROM print3d_filament_stock')) return rows(data.stock[args[0]] === undefined ? [] : [{quantity_grams:data.stock[args[0]]}]);
    if (sql.startsWith('UPDATE print3d_filament_stock SET quantity_grams=quantity_grams-')) {if(data.stock[args[1]] < args[2])return [{affectedRows:0}];data.stock[args[1]]-=args[0];return [{affectedRows:1}];}
    if (sql.startsWith('INSERT INTO print3d_filament_movements')) {data.movements.push({filament_id:args[1],production_event_id:args[3],quantity_delta_grams:args[4]});return [{affectedRows:1}];}
    if (sql.startsWith('SELECT * FROM print3d_order_payment_receipts')) return rows(data.receipts.filter(receipt =>
      receipt.provider === args[0] && (receipt.event_key === args[1] || receipt.provider_payment_id === args[2])));
    if (sql.startsWith('INSERT INTO print3d_order_payment_receipts')) {
      const [id, order_id, event_key, provider, provider_payment_id, amount_cents, confirmed_at, payload_hash] = args;
      assert.equal(data.receipts.some(receipt => receipt.provider === provider
        && (receipt.event_key === event_key || receipt.provider_payment_id === provider_payment_id)), false);
      data.receipts.push({ id, order_id, event_key, provider, provider_payment_id, amount_cents,
        confirmed_at, payload_hash, status: 'confirmed' });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM print3d_order_item_plans p JOIN order_items')) return rows(data.itemPlans
      .filter(plan => plan.order_id === args[0] && plan.preorder_quantity > 0)
      .map(plan => ({ ...plan, product_name: data.items.find(item => item.id === plan.order_item_id)?.product_name,
        product_sku: data.items.find(item => item.id === plan.order_item_id)?.product_sku,
        ...data.recipes.find(recipe => recipe.product_id === plan.product_id),recipe_sku:'CH-01',
        primary_file_kind:'gcode',primary_printer_profile:'Impressora A · PLA' })));
    if (sql.startsWith('SELECT id FROM print3d_production_jobs WHERE order_item_id=')) return rows(data.jobs.filter(job => job.order_item_id === args[0]));
    if (sql.startsWith('INSERT INTO print3d_production_jobs')) {
      const [id, order_id, order_number, order_item_id, product_id, product_name, sku, target_quantity, recipe_id, primary_file_id] = args;
      assert.equal(data.jobs.some(job => job.order_item_id === order_item_id), false);
      data.jobs.push({ id, order_id, order_number, order_item_id, product_id, product_name, sku,
        target_quantity, recipe_id, primary_file_id, approved_quantity: 0, rejected_quantity: 0,
        status: 'awaiting_payment', created_at: '2026-09-27T12:00:00Z' });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE print3d_production_jobs SET status='queued'")) {
      const jobs = data.jobs.filter(job => job.order_id === args[0] && job.status === 'awaiting_payment');
      jobs.forEach(job => { job.status = 'queued'; }); return [{ affectedRows: jobs.length }];
    }
    if (sql.startsWith('SELECT order_id FROM print3d_production_jobs')) return rows(data.jobs.filter(job => job.id === args[0]).map(job => ({ order_id: job.order_id })));
    if (sql.startsWith('SELECT * FROM print3d_production_jobs WHERE id=')) return rows(data.jobs.filter(job => job.id === args[0]));
    if (sql.startsWith('SELECT * FROM print3d_production_events WHERE job_id=? AND idempotency_key=')) return rows(data.events.filter(event => event.job_id === args[0] && event.idempotency_key === args[1]));
    if (sql.startsWith('SELECT * FROM print3d_production_events WHERE job_id')) return rows(data.events.filter(event => args.includes(event.job_id)));
    if (sql.startsWith('INSERT INTO print3d_production_events')) {
      const [id, job_id, idempotency_key, payload_hash, approved_quantity, rejected_quantity, material_consumed_grams, note, actor_id] = args;
      assert.equal(data.events.some(event => event.job_id === job_id && event.idempotency_key === idempotency_key), false);
      data.events.push({ id, job_id, idempotency_key, payload_hash, approved_quantity, rejected_quantity, material_consumed_grams, note, actor_id,
        created_at: '2026-09-27T13:00:00Z' }); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO print3d_production_outputs')) {
      const [id,job_id,production_event_id,order_id,order_item_id,product_id,quantity] = args;
      data.outputs.push({ id,job_id,production_event_id,order_id,order_item_id,product_id,quantity,status:'reserved_for_order' });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM print3d_production_outputs')) return rows(data.outputs.filter(output => args.includes(output.job_id)));
    if (sql.startsWith('UPDATE print3d_production_jobs SET approved_quantity=')) {
      const job = data.jobs.find(value => value.id === args[3]);
      Object.assign(job, { approved_quantity: args[0], rejected_quantity: args[1], status: args[2] });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT j.id AS job_id,j.recipe_id,j.primary_file_id')) return rows(data.jobs
      .filter(job => args.includes(job.id)).map(job => ({job_id:job.id,recipe_id:job.recipe_id,primary_file_id:job.primary_file_id,
        recipe_product_id:job.product_id,sku_snapshot:job.sku,revision:'r1',file_id:job.primary_file_id,
        file_recipe_id:job.recipe_id,kind:'gcode',original_name:job.sku+'.gcode',printer_profile:'Impressora A · PLA',
        sha256:'a'.repeat(64),byte_size:1200})));
    if (sql.includes('FROM print3d_production_jobs j JOIN orders')) {
      const jobs = data.jobs.filter(job => {
        const order = data.orders.find(value => value.id === job.order_id);
        if (!order || order.storefront !== 'loja_3d' || order.customer_id) return false;
        if (sql.includes('WHERE j.id=?') && job.id !== args[0]) return false;
        if (sql.includes('o.print3d_customer_id=?') && order.print3d_customer_id !== args.at(-1)) return false;
        return true;
      }).map(job => ({ ...job, status: data.orders.some(order => order.id === job.order_id
        && (order.status === 'cancelled' || order.payment_status === 'refunded')) ? 'cancelled' : job.status }));
      return rows(jobs);
    }
    throw new Error('SQL fora da cascata local: ' + sql);
  };
  const pool = { query, async getConnection() {
    let snapshot;
    return { query, async beginTransaction() {
      assert.equal(transactionActive, false); snapshot = structuredClone(data); transactionActive = true;
    }, async commit() { audit.commits++; }, async rollback() {
      Object.assign(data, snapshot); audit.rollbacks++;
    }, release() { transactionActive = false; } };
  } };
  async function transaction(callback) {
    const connection = await pool.getConnection(); await connection.beginTransaction();
    try { const result = await callback(connection); await connection.commit(); return result; }
    catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  const persistPlanAndCreate = () => transaction(async connection => {
    await savePrint3dOrderPlanOnConnection(connection, { orderId, quoteItems: [quote] });
    await createProductionJobsOnConnection(connection, { orderId });
  });
  const receipt = (amountCents, key) => ({ orderId, amountCents, eventKey: key,
    provider: 'verified-test-gateway', providerPaymentId: key, confirmedAt: '2026-09-27T12:00:00.000Z' });
  return { data, audit, pool, transaction, orderId, customerId, persistPlanAndCreate, receipt };
}

test('cascata: plano -> produção bloqueada -> 49% -> 50% -> 20/100 visível só ao cliente dono', async () => {
  const db = localDatabase();
  await db.persistPlanAndCreate();
  assert.equal(db.data.plans[0].due_on_confirmation_cents, 5000);
  assert.equal(db.data.jobs[0].status, 'awaiting_payment');
  assert.equal(db.data.jobs[0].target_quantity, 100);
  const jobId = db.data.jobs[0].id;
  const progress = { jobId, actorId: 'admin-test', body: { idempotency_key: randomUUID(),
    approved_quantity: 20, rejected_quantity: 2, material_consumed_grams: 35.5, filaments:[{filament_id:'filament-pla',consumed_grams:35.5}], note: 'Observação interna de impressão' } };
  // Uma alegação do navegador não é prova de recebimento.
  await assert.rejects(db.transaction(connection => releaseProductionJobsOnConnection(connection,
    { orderId: db.orderId, paid: true, amountCents: 5000 })), /entrada/);
  await db.transaction(connection => recordVerifiedPrint3dPaymentOnConnection(connection, db.receipt(4900, 'payment-49')));
  await assert.rejects(db.transaction(connection => releaseProductionJobsOnConnection(connection, { orderId: db.orderId })), /entrada/);
  await assert.rejects(recordProductionProgress(db.pool, progress), /não está liberada/);
  assert.equal(db.data.events.length, 0);
  const paid = await db.transaction(async connection => {
    const confirmed = await recordVerifiedPrint3dPaymentOnConnection(connection, db.receipt(100, 'payment-1'));
    assert.equal(confirmed.coverage.initial_payment_covered, true);
    assert.equal((await releaseProductionJobsOnConnection(connection, { orderId: db.orderId })).released, 1);
    return confirmed;
  });
  assert.equal(paid.coverage.fully_paid, false);
  assert.equal(paid.coverage.outstanding_cents, 5500); // metade restante + frete
  const first = await recordProductionProgress(db.pool, progress);
  assert.equal(first.job.approved_quantity, 20);
  assert.equal(first.job.material_consumed_grams, 35.5);
  assert.equal(first.job.reserved_for_order_quantity, 20);
  assert.equal(db.data.outputs.length, 1);
  assert.equal(db.data.stock['filament-pla'],964.5);
  assert.equal(first.job.target_quantity, 100);
  assert.equal(first.job.status, 'in_progress');
  assert.equal(first.job.primary_file.id,db.data.jobs[0].primary_file_id);
  assert.equal(first.job.primary_file.revision,'r1');
  assert.equal(first.job.primary_file.printer_profile,'Impressora A · PLA');
  assert.equal((await recordProductionProgress(db.pool, progress)).replayed, true);
  assert.equal(db.data.events.length, 1);
  const [customerJob] = await listProductionJobs(db.pool, { customerId: db.customerId });
  assert.equal(customerJob.order_number, '3D-1');
  assert.equal(customerJob.target_quantity - customerJob.approved_quantity, 80);
  assert.equal(customerJob.approved_quantity / customerJob.target_quantity * 100, 20);
  assert.equal(customerJob.history[0].approved_quantity, 20);
  assert.deepEqual(await listProductionJobs(db.pool, { customerId: randomUUID() }), []);
  for (const forbidden of ['recipe_id', 'primary_file_id', 'primary_file', 'recipe_summary', 'rejected_quantity', 'material_consumed_grams', 'actor_id', 'note']) {
    assert.equal(Object.hasOwn(customerJob, forbidden), false);
    assert.equal(Object.hasOwn(customerJob.history[0], forbidden), false);
  }
  assert.equal(JSON.stringify(customerJob).includes('Observação interna'), false);
  assert.equal(db.data.orders[0].payment_status, 'pending');
  assert.equal(db.data.orders[0].status, 'pending');
  assert.ok(db.audit.queries.every(sql => !/^(INSERT|UPDATE|DELETE).*\b(orders|products|product_stock_locations|stock_location_movements)\b/.test(sql)));
  assert.equal((await db.transaction(connection => readPrint3dPaymentCoverageOnConnection(connection, db.orderId))).outstanding_cents, 5500);
});

test('80 prontas + 20 encomendadas cria produção só de 20, sem recalcular estoque ou trocar arquivo do pedido', async () => {
  const db = localDatabase(80);
  await db.persistPlanAndCreate();
  const originalRecipe = db.data.jobs[0].recipe_id;
  const originalFile = db.data.jobs[0].primary_file_id;
  assert.equal(db.data.jobs[0].target_quantity, 20);
  assert.equal(db.data.plans[0].due_on_confirmation_cents, 5000); // 50% de todas as 100 peças, incluindo as 80 prontas
  db.data.recipes[0].recipe_id = randomUUID(); // próxima revisão não muda ordem já criada
  await db.persistPlanAndCreate();
  assert.equal(db.data.jobs.length, 1);
  assert.equal(db.data.jobs[0].recipe_id, originalRecipe);
  assert.equal(db.data.jobs[0].primary_file_id,originalFile);
  await db.transaction(async connection => {
    await recordVerifiedPrint3dPaymentOnConnection(connection, db.receipt(5000, 'mixed-entry'));
    await releaseProductionJobsOnConnection(connection, { orderId: db.orderId });
  });
  const body = { idempotency_key: randomUUID(), approved_quantity: 100, rejected_quantity: 0, material_consumed_grams: 20,filaments:[{filament_id:'filament-pla',consumed_grams:20}] };
  await assert.rejects(recordProductionProgress(db.pool, { jobId: db.data.jobs[0].id, actorId: 'admin', body }), /excede/);
  assert.equal(db.data.events.length, 0);
  const result = await recordProductionProgress(db.pool, { jobId: db.data.jobs[0].id, actorId: 'admin',
    body: { ...body, approved_quantity: 20 } });
  assert.equal(result.job.status, 'completed');
  assert.equal(result.job.target_quantity, 20);
  assert.equal(result.job.primary_file.id,originalFile);
  assert.equal(db.data.orders[0].status, 'pending');
  assert.equal(db.data.orders[0].payment_status, 'pending');
});

test('falha na ficha reverte plano e itens; criação não deixa ordem parcial', async () => {
  const db = localDatabase();
  db.data.recipes = [];
  await assert.rejects(db.persistPlanAndCreate(), /ficha/);
  assert.equal(db.data.plans.length, 0);
  assert.equal(db.data.itemPlans.length, 0);
  assert.equal(db.data.jobs.length, 0);
  assert.equal(db.audit.rollbacks, 1);
});
