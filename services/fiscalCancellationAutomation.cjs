'use strict';

const { marketplaceCancellationEvidence, assessNfeCancellation } = require('./fiscalCancellationCore.cjs');
const { consultInvoice } = require('./fiscalCertificateVault.cjs');
const { transmitCancellationEvent } = require('./fiscalCancellationSefaz.cjs');

function createFiscalCancellationAutomation({ pool, getLiveMarketplaceOrder, consult = consultInvoice,
  transmit = transmitCancellationEvent, now = () => new Date(), logger = console }) {
  async function processDocument(document, profile) {
    const [rows] = await pool.query('SELECT state FROM company_fiscal_cancellation_monitor WHERE document_id=?', [document.id]);
    const previous = rows[0]?.state;
    if (['confirmed', 'rejected', 'blocked'].includes(previous)) return previous;
    const sefaz = await consult(profile.id, document.access_key, 'production');
    if (sefaz.situation === 'cancelled') {
      await pool.query('INSERT IGNORE INTO company_fiscal_cancellation_monitor (document_id,profile_id) VALUES (?,?)', [document.id, profile.id]);
      await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='confirmed',checked_at=NOW(),reason='sefaz_cancelled' WHERE document_id=?", [document.id]);
      const [updated] = await pool.query("UPDATE company_fiscal_documents SET status='cancelled' WHERE id=? AND profile_id=? AND status='authorized'", [document.id, profile.id]);
      if (updated.affectedRows === 1) await pool.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)',
        [profile.id, 'fiscal_automation', 'nfe_cancel_confirmed', JSON.stringify({ documentId: document.id, source: 'sefaz_consult' })]);
      return 'confirmed';
    }
    if (['accepted_pending_confirmation', 'uncertain', 'sending'].includes(previous)) return previous;
    const order = await getLiveMarketplaceOrder(document.channel, document.external_sale_id);
    const marketplace = marketplaceCancellationEvidence(document.channel, order, document.external_sale_id);
    const assessment = assessNfeCancellation({ document, profile, sefaz, marketplace, now: now() });
    await pool.query('INSERT IGNORE INTO company_fiscal_cancellation_monitor (document_id,profile_id) VALUES (?,?)', [document.id, profile.id]);
    if (assessment.alert) {
      await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='open_alert',marketplace_status=?,checked_at=NOW(),reason='open_order_with_authorized_nfe' WHERE document_id=? AND state IN ('pending','open_alert')", [marketplace.status || '', document.id]);
      return 'open_alert';
    }
    if (!assessment.eligible) {
      await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='blocked',marketplace_status=?,checked_at=NOW(),reason=? WHERE document_id=? AND state IN ('pending','open_alert')", [marketplace.status || '', assessment.blockers.join(','), document.id]);
      return 'blocked';
    }
    if (document.channel === 'tiktok') {
      const [shipping] = await pool.query("SELECT 1 FROM tiktok_shop_fulfillment_jobs WHERE order_id=? AND status IN ('shipping','shipped') LIMIT 1", [document.external_sale_id]);
      if (shipping.length) {
        await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='blocked',reason='internal_shipping_recorded',checked_at=NOW() WHERE document_id=? AND state IN ('pending','open_alert')", [document.id]);
        return 'blocked';
      }
    }
    const [claim] = await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='sending',attempted_at=NOW(),marketplace_status='CANCELLED',reason=NULL WHERE document_id=? AND state IN ('pending','open_alert')", [document.id]);
    if (claim.affectedRows !== 1) return 'already_claimed';
    try {
      const result = await transmit(profile.id, { accessKey: document.access_key, cnpj: profile.cnpj,
        authorizationProtocol: sefaz.authorizationProtocol, justification: assessment.justification,
        environment: 'production', occurredAt: now() });
      const state = result.accepted ? 'accepted_pending_confirmation' : 'rejected';
      await pool.query('UPDATE company_fiscal_cancellation_monitor SET state=?,reason=?,event_protocol=?,signed_event_xml=?,response_xml=?,checked_at=NOW() WHERE document_id=? AND state=\'sending\'',
        [state, result.reason || null, result.protocol || null, result.signedXml || null, result.responseXml || null, document.id]);
      return state;
    } catch (error) {
      // Timeout may mean SEFAZ received the event. Never retry blindly.
      await pool.query("UPDATE company_fiscal_cancellation_monitor SET state='uncertain',reason=?,checked_at=NOW() WHERE document_id=? AND state='sending'", [String(error.message || 'Falha de transmissão').slice(0, 255), document.id]);
      logger.error('[fiscal-cancellation] transmission uncertain', { documentId: document.id, message: error.message });
      return 'uncertain';
    }
  }

  async function tick() {
    const [documents] = await pool.query(`SELECT d.id,d.profile_id,d.model,d.channel,d.external_sale_id,d.access_key,d.status,p.cnpj,p.uf,
        m.state AS monitor_state
      FROM company_fiscal_documents d JOIN company_fiscal_profiles p ON p.id=d.profile_id
      LEFT JOIN company_fiscal_cancellation_monitor m ON m.document_id=d.id
      WHERE d.status='authorized' AND d.model='55' AND d.channel IN ('shopee','tiktok') AND p.uf='PE'
        AND d.created_at>=NOW()-INTERVAL 2 DAY
        AND (m.state IS NULL OR m.state IN ('open_alert','accepted_pending_confirmation','uncertain','sending'))
      ORDER BY CASE WHEN m.state IN ('accepted_pending_confirmation','uncertain','sending') THEN 0 WHEN m.state IS NULL THEN 1 ELSE 2 END,
        d.created_at ASC LIMIT 30`);
    const results = [];
    for (const document of documents) {
      try { results.push({ documentId: document.id, state: await processDocument(document, document) }); }
      catch (error) { logger.error('[fiscal-cancellation] check failed', { documentId: document.id, message: error.message }); }
    }
    return results;
  }
  async function processOrder(channel, orderId) {
    if (!['shopee','tiktok'].includes(channel) || !String(orderId || '').trim()) return [];
    const [documents] = await pool.query(`SELECT d.id,d.profile_id,d.model,d.channel,d.external_sale_id,d.access_key,d.status,p.cnpj,p.uf
      FROM company_fiscal_documents d JOIN company_fiscal_profiles p ON p.id=d.profile_id
      LEFT JOIN company_fiscal_cancellation_monitor m ON m.document_id=d.id
      WHERE d.channel=? AND d.external_sale_id=? AND d.status='authorized' AND d.model='55' AND p.uf='PE'
        AND (m.state IS NULL OR m.state IN ('open_alert','accepted_pending_confirmation','uncertain','sending'))
      LIMIT 5`, [channel, String(orderId)]);
    const results = [];
    for (const document of documents) {
      try { results.push({ documentId: document.id, state: await processDocument(document, document) }); }
      catch (error) { logger.error('[fiscal-cancellation] order check failed', { documentId: document.id, message: error.message }); }
    }
    return results;
  }
  return { processDocument, processOrder, tick };
}

module.exports = { createFiscalCancellationAutomation };
