'use strict';

function createPrint3dWhatsAppSender({ webhookUrl, webhookToken, evolutionInstance,
  senderPhone, mercadoDoValePhone, fetchImpl = fetch }) {
  let url;
  try { url = new URL(webhookUrl); } catch { url = null; }
  const instance = String(evolutionInstance || '').trim();
  const ownNumber = String(senderPhone || '').replace(/\D/g, '');
  const mdvNumber = String(mercadoDoValePhone || '').replace(/\D/g, '');
  const configured = url?.protocol === 'https:' && !url.username && !url.password && !url.hash
    && typeof webhookToken === 'string' && webhookToken.length >= 32
    && /^[a-zA-Z0-9_.-]{3,80}$/.test(instance) && instance.toLowerCase() !== 'botmercadodovale'
    && /^55\d{10,11}$/.test(ownNumber) && /^55\d{10,11}$/.test(mdvNumber) && ownNumber !== mdvNumber;

  const sendPrint3dVerification = async function (phone, text, purpose = 'print3d_phone_verification') {
    if (!configured) return { ok: false, reason: 'print3d_whatsapp_not_configured' };
    if (!['print3d_phone_verification', 'print3d_deadline_request'].includes(purpose)
      || !/^55\d{10,11}$/.test(phone) || typeof text !== 'string' || text.length < 10 || text.length > 1200) {
      return { ok: false, reason: 'invalid_payload' };
    }
    try {
      const response = await fetchImpl(url.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-print3d-verification-key': webhookToken },
        body: JSON.stringify({ phone, text, purpose }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return { ok: false, reason: 'n8n_send_failed' };
      const data = await response.json();
      // O webhook deve responder somente depois de receber sucesso da Evolution.
      if (data?.ok !== true || data.instance !== instance || String(data.sender_phone || '').replace(/\D/g, '') !== ownNumber
        || typeof data.message_id !== 'string'
        || data.message_id.length < 3 || data.message_id.length > 255) {
        return { ok: false, reason: 'n8n_send_unconfirmed' };
      }
      return { ok: true, instance, messageId: data.message_id };
    } catch { return { ok: false, reason: 'n8n_unavailable' }; }
  };
  sendPrint3dVerification.configured = Boolean(configured);
  return sendPrint3dVerification;
}

module.exports = { createPrint3dWhatsAppSender };
