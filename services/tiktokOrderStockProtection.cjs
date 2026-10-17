'use strict';

const { decrementPriorityStockOnConnection } = require('./priorityStockDecrement.cjs');

const CANCELLED = /CANCEL/i;
const COMMITTED_STATUSES = new Set(['ON_HOLD', 'AWAITING_SHIPMENT', 'AWAITING_COLLECTION']);

function normalizeOrderLines(order) {
  const grouped = new Map();
  for (const item of Array.isArray(order?.line_items) ? order.line_items : []) {
    const sku = String(item?.seller_sku || '').trim().toUpperCase();
    // TikTok order details normally represent one sold unit per line_item and
    // omit `quantity`. Keep supporting payload variants that provide it.
    const rawQuantity = item?.quantity;
    const quantity = rawQuantity === undefined || rawQuantity === null || rawQuantity === ''
      ? 1
      : Math.max(0, Math.trunc(Number(rawQuantity) || 0));
    if (!sku || !quantity) continue;
    grouped.set(sku, (grouped.get(sku) || 0) + quantity);
  }
  return [...grouped.entries()].map(([sku, quantity]) => ({ sku, quantity }));
}

function shouldProtectOrder(status) {
  const value = String(status || '').toUpperCase();
  return COMMITTED_STATUSES.has(value);
}

function isCancelledOrder(status) {
  return CANCELLED.test(String(status || '').toUpperCase());
}

function createTikTokOrderStockProtection({ pool, logger = console, decrementStock = decrementPriorityStockOnConnection }) {
  let ready;
  function ensureSchema() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS tiktok_order_stock_events (
      event_key VARCHAR(190) NOT NULL PRIMARY KEY,
      order_id VARCHAR(80) NOT NULL,
      product_id CHAR(36) NULL,
      seller_sku VARCHAR(190) NOT NULL,
      requested_quantity INT UNSIGNED NOT NULL,
      applied_quantity INT UNSIGNED NOT NULL DEFAULT 0,
      state VARCHAR(24) NOT NULL DEFAULT 'processing',
      order_status VARCHAR(64) NULL,
      last_error VARCHAR(1000) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      absorbed_at DATETIME(3) NULL,
      restored_at DATETIME(3) NULL,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX order_state (order_id,state),
      INDEX product_state (product_id,state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      .catch(error => { ready = undefined; throw error; });
    return ready;
  }

  async function protectLine(orderId, orderStatus, line) {
    const eventKey = `${orderId}:${line.sku}`.slice(0, 190);
    const db = await pool.getConnection();
    try {
      await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await db.beginTransaction();
      const [inserted] = await db.query(`INSERT IGNORE INTO tiktok_order_stock_events
        (event_key,order_id,seller_sku,requested_quantity,order_status)
        VALUES (?,?,?,?,?)`, [eventKey, orderId, line.sku, line.quantity, orderStatus]);
      if (!Number(inserted.affectedRows)) {
        await db.rollback();
        return { duplicate: true, product_id: null };
      }
      const [[product]] = await db.query(`SELECT id FROM products
        WHERE UPPER(TRIM(sku))=? ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,created_at LIMIT 1 FOR UPDATE`, [line.sku]);
      if (!product) {
        await db.query(`UPDATE tiktok_order_stock_events SET state='unmapped',last_error='seller_sku_not_mapped',updated_at=NOW(3)
          WHERE event_key=?`, [eventKey]);
        await db.commit();
        return { duplicate: false, product_id: null, error: 'seller_sku_not_mapped' };
      }
      const [[availability]] = await db.query(`SELECT COALESCE(SUM(GREATEST(0,quantity-reserved_quantity)),0) AS available
        FROM product_stock_locations WHERE product_id=? FOR UPDATE`, [product.id]);
      const applied = Math.min(line.quantity, Math.max(0, Math.trunc(Number(availability?.available || 0))));
      if (applied > 0) {
        const outcome = await decrementStock(db, {
          product_id: product.id,
          quantity: applied,
          reference_type: 'tiktok_order',
          reference_id: eventKey,
          reason: 'Baixa provisoria de pedido TikTok Shop',
          notes: `Pedido TikTok ${orderId}`,
        });
        if (outcome.status !== 200) throw new Error(outcome.error || 'tiktok_stock_decrement_failed');
      }
      const state = applied < line.quantity ? 'shortage' : 'active';
      await db.query(`UPDATE tiktok_order_stock_events SET product_id=?,applied_quantity=?,state=?,last_error=?,updated_at=NOW(3)
        WHERE event_key=?`, [product.id, applied, state, state === 'shortage' ? 'insufficient_local_stock' : null, eventKey]);
      await db.commit();
      return { duplicate: false, product_id: product.id, applied, shortage: applied < line.quantity };
    } catch (error) {
      try { await db.rollback(); } catch {}
      throw error;
    } finally { db.release(); }
  }

  async function protectOrder(order) {
    await ensureSchema();
    const orderId = String(order?.id || '').trim();
    const status = String(order?.status || '').toUpperCase();
    if (!orderId || !shouldProtectOrder(status)) return { ok: true, skipped: 'order_not_committed', productIds: [] };
    const lines = normalizeOrderLines(order);
    if (!lines.length) return { ok: false, skipped: 'no_seller_skus', productIds: [], results: [{ error: 'no_seller_skus' }] };
    const results = [];
    for (const line of lines) results.push(await protectLine(orderId, status, line));
    const productIds = [...new Set(results.map(row => row.product_id).filter(Boolean))];
    return { ok: results.every(row => !row.error), productIds, results };
  }

  async function restoreOrder(order) {
    await ensureSchema();
    const orderId = String(order?.id || '').trim();
    if (!orderId || !isCancelledOrder(order?.status)) return { ok: true, skipped: 'not_cancelled', productIds: [] };
    const db = await pool.getConnection();
    try {
      await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await db.beginTransaction();
      const [events] = await db.query(`SELECT * FROM tiktok_order_stock_events
        WHERE order_id=? AND state IN ('active','shortage') ORDER BY product_id,event_key FOR UPDATE`, [orderId]);
      const changed = new Set();
      const productIds = [...new Set(events.map(event => event.product_id).filter(Boolean))].sort();
      for (const productId of productIds) {
        await db.query('SELECT id FROM products WHERE id=? LIMIT 1 FOR UPDATE', [productId]);
      }
      for (const event of events) {
        const amount = Math.max(0, Math.trunc(Number(event.applied_quantity || 0)));
        if (amount > 0) {
          const [movements] = await db.query(`SELECT * FROM stock_location_movements
            WHERE reference_type='tiktok_order' AND reference_id=? AND movement_type='sale'
            ORDER BY created_at,id FOR UPDATE`, [event.event_key]);
          for (const movement of movements) {
            const quantity = Math.max(0, Math.trunc(Number(movement.quantity || 0)));
            if (!quantity) continue;
            await db.query(`UPDATE product_stock_locations SET quantity=quantity+?,updated_at=NOW(3)
              WHERE product_id=? AND deposit_id=? AND location_id=?`,
            [quantity, movement.product_id, movement.from_deposit_id, movement.from_location_id]);
            await db.query(`INSERT INTO stock_location_movements
              (id,company_id,product_id,to_deposit_id,to_location_id,quantity,movement_type,reason,reference_type,
               reference_id,previous_to_quantity,new_to_quantity,notes)
              SELECT UUID(),company_id,product_id,from_deposit_id,from_location_id,quantity,'cancel',
                'Cancelamento TikTok antes da confirmacao do Bling','tiktok_order_restore',reference_id,
                new_from_quantity,new_from_quantity+quantity,? FROM stock_location_movements WHERE id=?`,
            [`Pedido TikTok ${orderId}`, movement.id]);
            changed.add(movement.product_id);
          }
        }
        await db.query(`UPDATE tiktok_order_stock_events SET state='restored',restored_at=NOW(3),updated_at=NOW(3)
          WHERE event_key=?`, [event.event_key]);
      }
      for (const productId of changed) {
        const [[total]] = await db.query('SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?', [productId]);
        await db.query('UPDATE products SET stock_quantity=?,updated_at=NOW(3) WHERE id=?', [Number(total.quantity), productId]);
      }
      await db.commit();
      return { ok: true, productIds: [...changed], restored: events.length };
    } catch (error) {
      try { await db.rollback(); } catch {}
      throw error;
    } finally { db.release(); }
  }

  async function absorbProducts(productIds) {
    const ids = [...new Set((productIds || []).map(String).filter(Boolean))];
    if (!ids.length) return;
    await ensureSchema();
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`UPDATE tiktok_order_stock_events SET state='absorbed',absorbed_at=NOW(3),updated_at=NOW(3)
      WHERE product_id IN (${placeholders}) AND state IN ('active','shortage')`, ids);
  }

  async function getStatus(limit = 25) {
    await ensureSchema();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
    const [summary] = await pool.query(`SELECT state,COUNT(*) AS total,MIN(updated_at) AS oldest_at
      FROM tiktok_order_stock_events GROUP BY state ORDER BY state`);
    const [attention] = await pool.query(`SELECT order_id,product_id,seller_sku,requested_quantity,applied_quantity,
        state,order_status,last_error,updated_at
      FROM tiktok_order_stock_events WHERE state IN ('shortage','unmapped','processing')
      ORDER BY updated_at DESC LIMIT ?`, [safeLimit]);
    return { summary: summary || [], attention: attention || [] };
  }

  return { ensureSchema, protectOrder, restoreOrder, absorbProducts, getStatus };
}

module.exports = { createTikTokOrderStockProtection, normalizeOrderLines, shouldProtectOrder, isCancelledOrder };
