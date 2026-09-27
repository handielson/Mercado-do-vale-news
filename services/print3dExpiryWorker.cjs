'use strict';

const { expireDuePrint3dOrders } = require('./print3dCancellation.cjs');

function expiryWorkerConfig(env = process.env) {
  if (env.MDV_PRINT3D_EXPIRY_ENABLED !== '1' || env.MDV_PRINT3D_CHECKOUT_ENABLED !== '1') return null;
  const configured = Number(env.MDV_PRINT3D_EXPIRY_INTERVAL_MS || 300000);
  const intervalMs = Number.isSafeInteger(configured) && configured >= 60000 && configured <= 3600000 ? configured : null;
  return intervalMs ? { intervalMs } : null;
}
function createPrint3dExpiryWorker({ pool, checkoutEnabled = false, env = process.env, logger = console, expire = expireDuePrint3dOrders, cancelProviderCharges }) {
  // The environment declaration alone is insufficient: the server passes the
  // complete checkout readiness predicate after validating all dependencies.
  const config = checkoutEnabled === true ? expiryWorkerConfig(env) : null;
  let timer = null;
  let running = false;
  async function runOnce() {
    if (!config) return { enabled:false, skipped:'disabled' };
    if (running) return { enabled:true, skipped:'running' };
    running = true;
    try {
      const result=await expire(pool,{ limit:100 });
      if (result.review_order_ids?.length) logger?.warn?.({ count:result.review_order_ids.length }, 'print3d-expiry-review');
      const retries = cancelProviderCharges ? (await pool.query(`SELECT c.order_id FROM print3d_payment_charges c
        JOIN orders o ON o.id=c.order_id
        WHERE o.storefront='loja_3d' AND o.status='cancelled' AND o.customer_id IS NULL
          AND c.status IN ('cancelled','late_payment')
        GROUP BY c.order_id ORDER BY MIN(c.updated_at),c.order_id LIMIT 100`))[0] : [];
      for (const orderId of new Set([...(result.order_ids || []),...retries.map(row=>row.order_id)])) {
        try { await cancelProviderCharges?.(orderId); } catch { /* Local cancellation remains authoritative. */ }
      }
      return { enabled:true, ...result };
    }
    catch (error) {
      // Do not log payment data, customer data or provider responses.
      logger?.error?.({ code:error.code || 'print3d_expiry_failure' }, 'print3d-expiry');
      return { enabled:true, failed:true };
    } finally { running = false; }
  }
  function start() {
    if (!config || timer) return Boolean(timer);
    timer = setInterval(() => { void runOnce(); }, config.intervalMs);
    timer.unref?.();
    void runOnce();
    return true;
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { config, runOnce, start, stop, get running() { return running; } };
}

module.exports = { expiryWorkerConfig, createPrint3dExpiryWorker };
