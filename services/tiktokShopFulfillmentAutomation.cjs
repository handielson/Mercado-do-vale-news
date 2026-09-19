'use strict';

const { shipPackageBody, SHIP_PATH } = require('./tiktokShopFulfillmentService.cjs');

async function ensureTikTokFulfillmentTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS tiktok_shop_fulfillment_jobs (
    package_id VARCHAR(80) NOT NULL PRIMARY KEY,
    order_id VARCHAR(40) NOT NULL,
    status ENUM('pending','uploading','uploaded','shipping','shipped','intervention') NOT NULL DEFAULT 'pending',
    invoice_uploaded_at DATETIME NULL,
    shipped_at DATETIME NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tiktok_fulfillment_status (status, updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function createTikTokFulfillmentAutomation({ pool, uploadOrderInvoice, callApi, loadSettings, logger = console }) {
  const processOrder = async order => {
    const orderId = String(order?.id || '');
    if (!/^\d{8,32}$/.test(orderId) || String(order.status || '').toUpperCase() !== 'AWAITING_SHIPMENT'
      || order.cancellation_request || order.cancel_reason) return;
    const invoiceState = String(order.need_upload_invoice || '').toUpperCase();
    for (const pkg of order.packages || []) {
      const packageId = String(pkg.id || pkg.package_id || '');
      if (!packageId) continue;
      await pool.query('INSERT IGNORE INTO tiktok_shop_fulfillment_jobs (package_id,order_id) VALUES (?,?)', [packageId, orderId]);
      const [rows] = await pool.query('SELECT status,last_error,updated_at FROM tiktok_shop_fulfillment_jobs WHERE package_id=?', [packageId]);
      const current = rows?.[0]?.status;
      if (invoiceState === 'INVOICE_UPLOADED' && ['uploading', 'intervention'].includes(current)) {
        await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET status='uploaded',invoice_uploaded_at=COALESCE(invoice_uploaded_at,NOW()),last_error=NULL WHERE package_id=? AND status IN ('uploading','intervention')", [packageId]);
      }
      if (invoiceState === 'NEED_INVOICE' && current === 'pending'
        && (!rows[0].last_error || Date.now() - new Date(rows[0].updated_at).getTime() > 5 * 60 * 1000)) {
        const [claim] = await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET status='uploading' WHERE package_id=? AND status='pending'", [packageId]);
        if (!claim.affectedRows) continue;
        try {
          await uploadOrderInvoice(orderId, packageId);
          await pool.query('UPDATE tiktok_shop_fulfillment_jobs SET invoice_uploaded_at=NOW() WHERE package_id=?', [packageId]);
        } catch (error) {
          await pool.query('UPDATE tiktok_shop_fulfillment_jobs SET status=?,last_error=? WHERE package_id=?',
            [error.beforeTikTokUpload ? 'pending' : 'intervention', String(error.message || error).slice(0, 1000), packageId]);
          logger.error(`[tiktok-shop] NF-e ${orderId}: ${error.message}`);
        }
      }
      if (['INVOICE_UPLOADED', 'NO_NEED'].includes(invoiceState) && ['pending', 'uploaded'].includes(current)) {
        const [claim] = await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET status='shipping' WHERE package_id=? AND status IN ('pending','uploaded')", [packageId]);
        if (!claim.affectedRows) continue;
        try {
          const settings = await loadSettings();
          const result = await callApi(settings, { method: 'POST', pathname: SHIP_PATH,
            body: shipPackageBody(packageId, { handoverMethod: 'DROP_OFF' }) });
          if (result?.payload?.data?.errors?.length) throw new Error('TikTok recusou expedição do pacote');
          await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET status='shipped',shipped_at=NOW(),last_error=NULL WHERE package_id=?", [packageId]);
        } catch (error) {
          // No blind retry: a timeout may have reached TikTok. A later read of
          // AWAITING_COLLECTION reconciles it without issuing a second ship.
          await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET last_error=? WHERE package_id=?",
            [String(error.message || error).slice(0, 1000), packageId]);
          logger.error(`[tiktok-shop] Expedição ${orderId}: ${error.message}`);
        }
      }
    }
  };
  const reconcileCollected = async order => {
    if (String(order?.status || '').toUpperCase() !== 'AWAITING_COLLECTION') return;
    for (const pkg of order.packages || []) {
      const packageId = String(pkg.id || pkg.package_id || '');
      if (!packageId) continue;
      await pool.query("UPDATE tiktok_shop_fulfillment_jobs SET status='shipped',shipped_at=COALESCE(shipped_at,NOW()),last_error=NULL WHERE package_id=? AND status='shipping'", [packageId]);
    }
  };
  return { processOrder, reconcileCollected };
}

module.exports = { ensureTikTokFulfillmentTable, createTikTokFulfillmentAutomation };
