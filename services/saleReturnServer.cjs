'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const core = require('./saleReturnCore.cjs');

// Devolução de itens da venda (Parte 3). Só admin. Arquivos ficam em private-uploads/sale-returns.
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const saleCode = id => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

async function ensureSaleReturnSchema(db, addColumnIfMissing) {
  await db.query(`CREATE TABLE IF NOT EXISTS sale_returns (
    id CHAR(36) NOT NULL PRIMARY KEY, sale_id CHAR(36) NOT NULL, code VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pendente', reason VARCHAR(500) NOT NULL, total_cents INT NOT NULL,
    refund_mode VARCHAR(8) NOT NULL, operator_user_id VARCHAR(80) NULL, operator_name VARCHAR(200) NULL,
    cash_session_id VARCHAR(80) NULL, client_request_id VARCHAR(80) NULL, UNIQUE KEY uniq_sale_returns_request (client_request_id), whatsapp_status VARCHAR(16) NULL, whatsapp_sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_at DATETIME NULL,
    INDEX idx_sale_returns_sale (sale_id, created_at), INDEX idx_sale_returns_status (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS sale_return_items (
    id CHAR(36) NOT NULL PRIMARY KEY, return_id CHAR(36) NOT NULL, sale_id CHAR(36) NOT NULL, sale_item_id VARCHAR(80) NOT NULL,
    product_id CHAR(36) NULL, quantity INT NOT NULL, value_cents INT NOT NULL, suggested_cents INT NULL, serialized_unit_id CHAR(36) NULL,
    INDEX idx_sale_return_items_sale (sale_id), INDEX idx_sale_return_items_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS sale_return_refunds (
    id CHAR(36) NOT NULL PRIMARY KEY, return_id CHAR(36) NOT NULL, sale_id CHAR(36) NOT NULL, payment_index INT NULL,
    method VARCHAR(32) NOT NULL, goods_cents INT NOT NULL, refund_cents INT NOT NULL, gateway VARCHAR(32) NOT NULL DEFAULT 'manual',
    gateway_payment_id VARCHAR(80) NULL, gateway_refund_id VARCHAR(80) NULL, gateway_status VARCHAR(16) NULL,
    INDEX idx_sale_return_refunds_sale (sale_id), INDEX idx_sale_return_refunds_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS sale_return_files (
    id CHAR(36) NOT NULL PRIMARY KEY, return_id CHAR(36) NOT NULL, kind VARCHAR(16) NOT NULL, refund_id CHAR(36) NULL,
    file_name VARCHAR(255) NOT NULL, mime VARCHAR(64) NOT NULL, path VARCHAR(500) NOT NULL, size_bytes INT NOT NULL,
    sha256 CHAR(64) NOT NULL, uploaded_by VARCHAR(80) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sale_return_files_return (return_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  if (addColumnIfMissing) {
    await addColumnIfMissing('sales', 'return_status', 'VARCHAR(16) NULL');
    await addColumnIfMissing('sales', 'profit_before_returns', 'INT NULL');
    await addColumnIfMissing('sales', 'returned_cents', 'INT NULL');
    await addColumnIfMissing('sales', 'returned_cost_cents', 'INT NULL');
  }
}

// Já estornado por forma de pagamento, em "valor de produto" (estorno parcial antigo vem com juros).
async function refundedByIndex(db, saleId, payments, totals = null) {
  const map = new Map();
  const add = (i, v) => map.set(i, (map.get(i) || 0) + v);
  const [partial] = await db.query("SELECT payment_index, amount FROM sale_partial_refunds WHERE sale_id = ? AND status = 'completed'", [saleId]);
  for (const r of partial || []) {
    const p = payments[Number(r.payment_index)]; if (!p) continue;
    const amount = Math.round(Number(p.amount) || 0), withFee = Math.round(Number(p.total_with_fee ?? p.amount) || 0);
    add(Number(r.payment_index), withFee > 0 ? Math.round(Number(r.amount) * amount / withFee) : Number(r.amount));
  }
  const [returned] = await db.query('SELECT payment_index, goods_cents FROM sale_return_refunds WHERE sale_id = ?', [saleId]);
  for (const r of returned || []) {
    if (r.payment_index != null) add(Number(r.payment_index), Number(r.goods_cents));
    else if (totals) totals.unindexed = (totals.unindexed || 0) + Number(r.goods_cents || 0);
  }
  return map;
}

async function createSaleReturn({ db, saleId, body = {}, actor, request, deps }) {
  const reason = String(body.reason || '').trim();
  if (!reason) fail(400, 'Informe o motivo da devolução.');
  const wanted = Array.isArray(body.items) ? body.items : [];
  if (!wanted.length) fail(400, 'Escolha pelo menos um item para devolver.');
  const mode = body.refund_mode === 'other' ? 'other' : 'same';
  await db.beginTransaction();
  try {
    const [[sale]] = await db.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [saleId]);
    if (!sale) fail(404, 'Venda não encontrada.');
    const requestId = String(body.client_request_id || '').trim().slice(0, 80) || null;
    if (requestId && !body.dry_run) {
      const [[done]] = await db.query('SELECT id FROM sale_returns WHERE client_request_id = ? LIMIT 1', [requestId]);
      if (done) { await db.rollback(); return { id: done.id, replay: true }; }
    }
    if (['cancelled', 'canceled', 'refunded'].includes(String(sale.payment_status))) fail(409, 'Esta venda já está cancelada ou estornada.');
    const payments = core.paymentsOf(sale);
    if (payments.some(p => p.method === 'a_prazo')) fail(409, 'Venda no crediário: ajuste pelo crediário.');
    const [items] = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    // Vendas antigas gravadas em reais (com casas decimais) não entram no cálculo automático.
    const money = [sale.total, ...items.map(i => i.total), ...payments.flatMap(pm => [pm.amount, pm.total_with_fee])].filter(v => v != null && v !== '');
    if (money.some(v => !Number.isInteger(Number(v)))) fail(409, 'Venda antiga gravada em reais: faça o estorno manual pelo Estornar venda.');
    const [returnedRows] = await db.query('SELECT sale_item_id, quantity, value_cents, suggested_cents FROM sale_return_items WHERE sale_id = ?', [saleId]);
    const returnable = core.returnableItems(sale, items, returnedRows);
    const byId = new Map(returnable.map(r => [r.saleItemId, r]));
    const returnedValue = new Map();
    // O resto da última leva parte do que foi sugerido antes (valor reduzido pelo operador não volta depois).
    for (const r of returnedRows || []) returnedValue.set(String(r.sale_item_id), (returnedValue.get(String(r.sale_item_id)) || 0) + Number(r.suggested_cents ?? r.value_cents ?? 0));
    const chosen = [];
    for (const w of wanted) {
      const row = byId.get(String(w?.sale_item_id || ''));
      const qty = Number(w?.quantity);
      if (!row) fail(400, 'Item não pertence a esta venda.');
      if (!Number.isSafeInteger(qty) || qty <= 0) fail(400, 'Quantidade inválida.');
      if (chosen.some(c => c.row.saleItemId === row.saleItemId)) fail(400, 'Item repetido na devolução.');
      if (qty > row.returnableQuantity) fail(409, `${row.name || 'Item'} já foi devolvido ou a quantidade passa do que foi vendido.`);
      // Última leva do item leva o resto do valor pago (centavos fecham).
      const value = qty === row.returnableQuantity
        ? row.paidValueCents - (returnedValue.get(row.saleItemId) || 0)
        : Math.round(row.paidValueCents * qty / row.quantity);
      chosen.push({ row, qty, value });
    }
    const suggested = chosen.reduce((a, c) => a + c.value, 0);
    const amount = body.amount_cents == null ? suggested : Math.round(Number(body.amount_cents));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > suggested) fail(400, 'O valor da devolução precisa ser maior que zero e no máximo o valor pago pelos itens.');

    const totals = {};
    const byIndex = await refundedByIndex(db, saleId, payments, totals);
    const alreadyRefunded = [...byIndex.values()].reduce((a, v) => a + v, 0) + (totals.unindexed || 0);
    const stillRefundable = payments.reduce((a, pm) => a + Math.round(Number(pm.amount) || 0), 0) - alreadyRefunded;
    if (amount > stillRefundable) fail(409, `Esse valor passa do que ainda pode ser devolvido: desta venda já foi estornado R$ ${(alreadyRefunded / 100).toFixed(2).replace('.', ',')}.`);
    const plan = mode === 'same'
      ? core.planSameMethodRefund(payments, amount, byIndex).map(p => ({
        payment_index: p.paymentIndex, method: p.method, goods_cents: p.goodsCents, refund_cents: p.refundCents, gateway_payment_id: p.gatewayPaymentId }))
      : core.validateOtherRefunds(body.refunds, amount).map(r => ({ payment_index: null, method: r.method, goods_cents: r.amount_cents, refund_cents: r.amount_cents, gateway_payment_id: null }));
    const cashSessionId = String(body.cash_session_id || '').trim() || null;
    if (plan.some(r => ['money', 'cash'].includes(r.method))) {
      const [open] = cashSessionId ? await db.query('SELECT status FROM pdv_cash_sessions WHERE id = ?', [cashSessionId]) : [[]];
      if (open?.[0]?.status !== 'open') fail(409, 'Abra o caixa para devolver em dinheiro.');
    }
    const cashCents = plan.filter(r => ['money', 'cash'].includes(r.method)).reduce((a, r) => a + r.refund_cents, 0);
    const cashWords = cashCents ? core.amountInWords(cashCents) : null;
    if (body.dry_run) {
      await db.rollback();
      return {
        preview: true, suggested_cents: suggested, total_cents: amount, cash_cents: cashCents, cash_words: cashWords,
        refunds: plan.map(r => ({ method: r.method, goods_cents: r.goods_cents, refund_cents: r.refund_cents, payment_index: r.payment_index, gateway_payment_id: r.gateway_payment_id })),
      };
    }

    const id = crypto.randomUUID();
    const code = saleCode(id);
    // Pix do Mercado Pago: grava como pendente e só chama o gateway depois do commit (nada estornado sem registro).
    for (const r of plan) {
      r.id = crypto.randomUUID();
      const viaGateway = r.method === 'pix' && r.gateway_payment_id;
      r.gateway = viaGateway ? 'mercado_pago' : 'manual'; r.gateway_refund_id = null; r.gateway_status = viaGateway ? 'pending' : null;
    }
    await db.query(`INSERT INTO sale_returns (id, sale_id, code, status, reason, total_cents, refund_mode, operator_user_id, operator_name, cash_session_id, client_request_id)
      VALUES (?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?)`, [id, saleId, code, reason.slice(0, 500), amount, mode, actor?.userId || null, actor?.name || null, cashSessionId, requestId]);
    // Valor gravado por item: proporcional ao total da devolução (o operador pode ter reduzido).
    let left = amount;
    chosen.forEach((c, i) => { c.stored = i === chosen.length - 1 ? left : Math.round(c.value * amount / suggested); left -= c.stored; });
    for (const c of chosen) {
      await db.query(`INSERT INTO sale_return_items (id, return_id, sale_id, sale_item_id, product_id, quantity, value_cents, suggested_cents, serialized_unit_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), id, saleId, c.row.saleItemId, c.row.productId, c.qty, c.stored, c.value, c.row.serializedUnitId]);
    }
    for (const r of plan) {
      await db.query(`INSERT INTO sale_return_refunds (id, return_id, sale_id, payment_index, method, goods_cents, refund_cents, gateway, gateway_payment_id, gateway_refund_id, gateway_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [r.id, id, saleId, r.payment_index, r.method, r.goods_cents, r.refund_cents, r.gateway, r.gateway_payment_id, r.gateway_refund_id, r.gateway_status]);
    }

    const restoreReason = `Devolução #${code} da venda #${saleCode(saleId)}`;
    const limits = new Map();
    const touched = new Set();
    const restored = new Map();
    for (const c of chosen) {
      if (c.row.serializedUnitId) {
        const [[unit]] = await db.query('SELECT * FROM units WHERE id = ? FOR UPDATE', [c.row.serializedUnitId]);
        if (!unit || String(unit.sale_id || '') !== String(saleId) || unit.status !== 'sold') fail(409, 'O aparelho desta venda não está mais como vendido. Confira o histórico do aparelho.');
        const [[product]] = await db.query('SELECT company_id FROM products WHERE id = ?', [unit.product_id]);
        const incoming = await deps.ensureIncomingStockLocation(product?.company_id, db);
        await db.query(`UPDATE units SET status = 'available', deposit_id = ?, location_id = ?, sale_id = NULL, order_id = NULL, sold_at = NULL WHERE id = ? AND status = 'sold'`,
          [incoming.depositId, incoming.locationId, unit.id]);
        await deps.recordUnitEvent(db, { unitId: unit.id, productId: unit.product_id, eventType: 'returned_to_incoming', actor,
          from: { depositId: unit.deposit_id, locationId: unit.location_id }, to: incoming, statusBefore: 'sold', statusAfter: 'available',
          referenceType: 'sale_return', referenceId: id, reason: `${restoreReason}: volta para conferência no Depósito.` });
        touched.add(unit.product_id);
        restored.set(unit.product_id, (restored.get(unit.product_id) || 0) + 1);
      } else if (c.row.productId) {
        limits.set(c.row.productId, (limits.get(c.row.productId) || 0) + c.qty);
      }
    }
    if (limits.size) {
      for (const row of (await deps.restoreStock(db, saleId, limits, restoreReason)) || []) {
        restored.set(row.product_id, (restored.get(row.product_id) || 0) + Number(row.quantity_restored || 0));
      }
    }
    for (const pid of touched) await deps.syncProductStock(pid, db, { stockLocationInTransaction: true });

    const fullyReturned = returnable.every(r => r.returnableQuantity === (chosen.find(c => c.row.saleItemId === r.saleItemId)?.qty || 0));
    const costBack = chosen.reduce((a, c) => a + Math.round(Number(items.find(i => String(i.id) === c.row.saleItemId)?.unit_cost || 0)) * c.qty, 0);
    await db.query(`UPDATE sales SET ${fullyReturned ? "payment_status = 'cancelled', " : ''}return_status = ?,
        profit_before_returns = COALESCE(profit_before_returns, profit), profit = profit - ?,
        returned_cents = COALESCE(returned_cents, 0) + ?, returned_cost_cents = COALESCE(returned_cost_cents, 0) + ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [fullyReturned ? 'full' : 'partial', amount - costBack, amount, costBack, saleId]);
    if (cashSessionId) {
      for (const r of plan) {
        await deps.recordCashEvent(db, request, { sessionId: cashSessionId, eventType: 'sale_refund', amountCents: r.refund_cents,
          referenceType: 'sale_return', referenceId: id, payload: { sale_id: saleId, method: r.method, payment_index: r.payment_index, reason } });
      }
    }
    await db.commit();
    const warnings = [];
    for (const r of plan.filter(x => x.gateway_status === 'pending')) {
      try {
        const mp = await deps.refundMercadoPagoPix(r.gateway_payment_id, r.refund_cents, `sale-return-${r.id}`);
        r.gateway_refund_id = mp?.refundId ? String(mp.refundId) : null; r.gateway_status = 'done';
      } catch (error) {
        r.gateway_status = 'failed';
        warnings.push(`O Pix não foi estornado no Mercado Pago (${error.message}). Faça o estorno manual e suba o comprovante.`);
        console.error('[sale-returns] estorno Pix no Mercado Pago falhou', { sale: saleId, return: id, refund: r.id, error: error.message });
      }
      await db.query('UPDATE sale_return_refunds SET gateway_status = ?, gateway_refund_id = ? WHERE id = ?', [r.gateway_status, r.gateway_refund_id, r.id]);
    }
    return {
      id, code, sale_id: saleId, warnings, restored: [...restored].map(([product_id, quantity]) => ({ product_id, quantity })), status: 'pendente', reason, total_cents: amount, refund_mode: mode, full: fullyReturned,
      cash_cents: cashCents, cash_words: cashWords, operator_name: actor?.name || null, created_at: new Date().toISOString(),
      items: chosen.map(c => ({ sale_item_id: c.row.saleItemId, name: c.row.name, sku: c.row.sku, quantity: c.qty, value_cents: c.stored, imei: c.row.imei, serialized_unit_id: c.row.serializedUnitId })),
      refunds: plan.map(r => ({ id: r.id, method: r.method, goods_cents: r.goods_cents, refund_cents: r.refund_cents, gateway_refund_id: r.gateway_refund_id, payment_index: r.payment_index })),
    };
  } catch (error) {
    if (!error.committed) await db.rollback().catch(() => {});
    throw error;
  }
}

function detectMime(buffer) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return ['application/pdf', '.pdf'];
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ['image/jpeg', '.jpg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['image/png', '.png'];
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return ['image/webp', '.webp'];
  return null;
}

async function saveReturnFile({ db, returnId, kind, refundId = null, fileName, base64, actor, root }) {
  if (!['proof', 'signed'].includes(kind)) fail(400, 'Tipo de arquivo inválido.');
  const raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) fail(400, 'Envie o arquivo.');
  if (raw.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4) fail(413, 'Arquivo maior que 12 MB.');
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > MAX_FILE_BYTES) fail(413, 'Arquivo maior que 12 MB.');
  const type = detectMime(buffer);
  if (!type) fail(400, 'Envie foto (JPG, PNG, WEBP) ou PDF.');
  const [refunds] = await db.query('SELECT * FROM sale_return_refunds WHERE return_id = ?', [returnId]);
  if (kind === 'proof' && !(refunds || []).some(r => String(r.id) === String(refundId))) fail(400, 'Escolha a qual estorno o comprovante pertence.');
  const id = crypto.randomUUID();
  const relative = path.posix.join('sale-returns', String(returnId).replace(/[^a-zA-Z0-9-]/g, ''), `${id}${type[1]}`);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer, { mode: 0o600 });
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  await db.query(`INSERT INTO sale_return_files (id, return_id, kind, refund_id, file_name, mime, path, size_bytes, sha256, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, returnId, kind, kind === 'proof' ? refundId : null, String(fileName || 'arquivo').slice(0, 255), type[0], relative, buffer.length, sha256, actor?.userId || null]);
  const [files] = await db.query('SELECT kind, refund_id FROM sale_return_files WHERE return_id = ?', [returnId]);
  const status = core.returnStatusOf({ refunds, files });
  await db.query("UPDATE sale_returns SET status = ?, finalized_at = IF(? = 'finalizada', COALESCE(finalized_at, CURRENT_TIMESTAMP), NULL) WHERE id = ?", [status, status, returnId]);
  return { id, status };
}

async function loadReturns(pool, where, params) {
  const [returns] = await pool.query(`SELECT * FROM sale_returns WHERE ${where} ORDER BY created_at DESC LIMIT 200`, params);
  if (!returns.length) return [];
  const ids = returns.map(r => r.id);
  const [items] = await pool.query(`SELECT ri.*, si.product_name AS name, si.product_sku AS sku, si.imei
      FROM sale_return_items ri LEFT JOIN sale_items si ON si.id = ri.sale_item_id WHERE ri.return_id IN (?)`, [ids]);
  const [refunds] = await pool.query('SELECT * FROM sale_return_refunds WHERE return_id IN (?)', [ids]);
  const [files] = await pool.query('SELECT id, return_id, kind, refund_id, file_name, mime, size_bytes, created_at FROM sale_return_files WHERE return_id IN (?)', [ids]);
  return returns.map(r => {
    const rf = refunds.filter(x => x.return_id === r.id);
    const fl = files.filter(x => x.return_id === r.id);
    const cashCents = rf.filter(x => ['money', 'cash'].includes(x.method)).reduce((a, x) => a + Number(x.refund_cents || 0), 0);
    return { ...r, items: items.filter(x => x.return_id === r.id), refunds: rf, files: fl,
      cash_cents: cashCents, cash_words: cashCents ? core.amountInWords(cashCents) : null,
      missing_proofs: core.requiredProofs(rf).filter(idr => !fl.some(f => f.kind === 'proof' && String(f.refund_id) === idr)),
      missing_signed: !fl.some(f => f.kind === 'signed') };
  });
}

function registerSaleReturnRoutes(app, deps) {
  const { pool, getBearerAuthContext, privateRoot } = deps;
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    let name = null;
    if (auth.customerId) { try { const [rows] = await pool.query('SELECT name FROM customers WHERE id = ? LIMIT 1', [auth.customerId]); name = rows?.[0]?.name || null; } catch { /* informativo */ } }
    req.saleReturnActor = { userId: auth.userId, name };
  };
  const send = (reply, error) => { if (!error.statusCode) throw error; return reply.code(error.statusCode).send({ error: error.message }); };

  app.get('/admin/sales/:saleId/returns', { preHandler: admin }, async (req, reply) => {
    const saleId = String(req.params.saleId);
    const [[sale]] = await pool.query('SELECT * FROM sales WHERE id = ? LIMIT 1', [saleId]);
    if (!sale) return reply.code(404).send({ error: 'Venda não encontrada.' });
    const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    const [returnedRows] = await pool.query('SELECT sale_item_id, quantity, value_cents, suggested_cents FROM sale_return_items WHERE sale_id = ?', [saleId]);
    const payments = core.paymentsOf(sale);
    return {
      returnable: core.returnableItems(sale, items, returnedRows), payments,
      refunded_by_index: Object.fromEntries(await refundedByIndex(pool, saleId, payments)),
      returns: await loadReturns(pool, 'sale_id = ?', [saleId]),
    };
  });

  app.post('/admin/sales/:saleId/returns', { preHandler: admin }, async (req, reply) => {
    const db = await pool.getConnection();
    try { return await createSaleReturn({ db, saleId: String(req.params.saleId), body: req.body || {}, actor: req.saleReturnActor, request: req, deps }); }
    catch (error) { return send(reply, error); }
    finally { db.release?.(); }
  });

  app.get('/admin/sale-returns', { preHandler: admin }, async req => {
    const status = String(req.query?.status || '');
    return { rows: await loadReturns(pool, status ? 'status = ?' : '1=1', status ? [status] : []) };
  });

  app.post('/admin/sale-returns/:id/files', { preHandler: admin, bodyLimit: 18 * 1024 * 1024 }, async (req, reply) => {
    const body = req.body || {};
    try {
      return await saveReturnFile({ db: pool, returnId: String(req.params.id), kind: body.kind, refundId: body.refund_id || null,
        fileName: body.file_name, base64: body.file_base64, actor: req.saleReturnActor, root: privateRoot });
    } catch (error) { return send(reply, error); }
  });

  app.get('/admin/sale-returns/:id/files/:fileId', { preHandler: admin }, async (req, reply) => {
    const [[file]] = await pool.query('SELECT * FROM sale_return_files WHERE id = ? AND return_id = ? LIMIT 1', [req.params.fileId, req.params.id]);
    if (!file) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    const full = path.join(privateRoot, file.path);
    if (!full.startsWith(path.resolve(privateRoot) + path.sep)) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    reply.header('Content-Type', file.mime).header('Content-Disposition', `inline; filename="${String(file.file_name).replace(/[^\w.\- ]/g, '_')}"`);
    return reply.send(fs.createReadStream(full));
  });

  app.post('/admin/sale-returns/:id/whatsapp', { preHandler: admin, bodyLimit: 22 * 1024 * 1024 }, async (req, reply) => {
    const raw = String(req.body?.pdf_base64 || '').replace(/^data:application\/pdf;base64,/i, '');
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') return reply.code(400).send({ error: 'Arquivo PDF inválido.' });
    const [[ret]] = await pool.query('SELECT * FROM sale_returns WHERE id = ? LIMIT 1', [req.params.id]);
    if (!ret) return reply.code(404).send({ error: 'Devolução não encontrada.' });
    const [[sale]] = await pool.query('SELECT customer_id FROM sales WHERE id = ? LIMIT 1', [ret.sale_id]);
    const [[customer]] = await pool.query('SELECT phone FROM customers WHERE id = ? LIMIT 1', [sale?.customer_id || '']);
    if (!customer?.phone) return reply.code(409).send({ error: 'Cliente sem telefone cadastrado.' });
    const result = await deps.sendWhatsappDocument(customer.phone, buffer, `recibo-devolucao-${ret.code}.pdf`, `Recibo da devolução #${ret.code} (venda #${saleCode(ret.sale_id)})`);
    const ok = Boolean(result?.ok);
    await pool.query('UPDATE sale_returns SET whatsapp_status = ?, whatsapp_sent_at = IF(?, CURRENT_TIMESTAMP, whatsapp_sent_at) WHERE id = ?', [ok ? 'sent' : 'failed', ok, ret.id]);
    return ok ? { status: 'sent' } : reply.code(502).send({ error: 'Não foi possível enviar pelo WhatsApp.' });
  });
}

module.exports = { ensureSaleReturnSchema, createSaleReturn, saveReturnFile, registerSaleReturnRoutes, MAX_FILE_BYTES };
