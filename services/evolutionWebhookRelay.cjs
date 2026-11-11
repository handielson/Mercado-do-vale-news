'use strict';

// evolution-webhook-relay-v1 (11/11/2026): a Evolution manda para cá e a API repassa ao n8n.
// Confirmações de entrega/leitura (messages.update sem texto editado) são descartadas aqui: cada uma abria uma
// execução no n8n e, em rajadas (ex.: Status visto por muitos contatos), esgotavam o banco do n8n e travavam o bot
// ("timeout exceeded when trying to connect", 10/11 21h e 11/11 09h39). Mensagens, edições e conexão passam intactas.

const N8N_BOT_WEBHOOK_URL = 'https://n8n.mercadodovale.com.br/webhook/whatsapp';
const N8N_BOT_RELAY_URL = 'https://api.xiaomipetrolina.com.br/webhooks/evolution/whatsapp';
const ACK_STATUSES = new Set(['PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED', 'ERROR', 'DELETED']);

const textOf = (candidate) => String(
  candidate?.conversation
  || candidate?.extendedTextMessage?.text
  || candidate?.imageMessage?.caption
  || candidate?.videoMessage?.caption
  || candidate?.documentMessage?.caption
  || ''
).trim();

// Mesmos lugares que o nó "Dados" do n8n (message-edit-recovery-v1) procura o texto editado.
function editedTextOf(data = {}) {
  const candidates = [
    data.editedMessage, data.edited_message,
    data.update?.editedMessage, data.update?.edited_message, data.update?.message,
    data.messageUpdate?.editedMessage, data.messageUpdate?.edited_message, data.messageUpdate?.message,
    data.message?.editedMessage, data.message?.edited_message, data.message?.protocolMessage?.editedMessage,
  ];
  for (const candidate of candidates) { const text = textOf(candidate); if (text) return text; }
  return '';
}

/** true = repassa ao n8n; false = confirmação de entrega/leitura sem conteúdo para o bot. */
function shouldRelayEvolutionEvent(body) {
  const event = String(body?.event || '').trim().toLowerCase().replace(/_/g, '.');
  if (event !== 'messages.update' && event !== 'messages.edited') return true;
  const data = body?.data || {};
  if (editedTextOf(data)) return true;
  const items = Array.isArray(data) ? data : [data];
  const statuses = items.map((item) => String(item?.status || item?.update?.status || '').toUpperCase());
  // Só descarta quando é claramente um recibo; qualquer atualização desconhecida segue para o n8n.
  return !(statuses.length && statuses.every((status) => ACK_STATUSES.has(status)));
}

function registerEvolutionWebhookRelay(fastify, { targetUrl = N8N_BOT_WEBHOOK_URL, instanceName = '', fetchImpl = globalThis.fetch, guard, logger = console } = {}) {
  const stats = { since: new Date().toISOString(), relayed: 0, dropped: 0, failed: 0, rejected: 0, lastRelayAt: null, lastDropAt: null, lastError: null };
  fastify.post('/webhooks/evolution/whatsapp', { bodyLimit: 64 * 1024 * 1024 }, async (req, reply) => {
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    if (!body) { stats.rejected += 1; return reply.code(400).send({ ok: false, error: 'JSON obrigatório' }); }
    if (instanceName && body.instance && String(body.instance) !== instanceName) { stats.rejected += 1; return reply.code(403).send({ ok: false, error: 'Instância não autorizada' }); }
    if (!shouldRelayEvolutionEvent(body)) {
      stats.dropped += 1; stats.lastDropAt = new Date().toISOString();
      return { ok: true, relayed: false };
    }
    try {
      const response = await fetchImpl(targetUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`n8n respondeu ${response.status}`);
      stats.relayed += 1; stats.lastRelayAt = new Date().toISOString();
      return { ok: true, relayed: true };
    } catch (error) {
      stats.failed += 1; stats.lastError = `${new Date().toISOString()} ${String(error?.message || error).slice(0, 160)}`;
      logger.warn?.('[evolution-webhook-relay] falha ao repassar ao n8n:', error?.message || error);
      return reply.code(502).send({ ok: false, relayed: false });
    }
  });
  fastify.get('/webhooks/evolution/whatsapp/stats', guard ? { preHandler: guard } : {}, async () => ({ ok: true, targetUrl, ...stats }));
  return stats;
}

module.exports = { N8N_BOT_WEBHOOK_URL, N8N_BOT_RELAY_URL, shouldRelayEvolutionEvent, editedTextOf, registerEvolutionWebhookRelay };
