const { createWhatsAppStatusHealth } = require('./whatsappStatusHealth.cjs');

function statusError(code, message) {
  return Object.assign(new Error(message), { code });
}

// WAHA/WPP can return a MsgKey, a raw engine result or a list of results.
// Only explicit message-id fields are accepted; never manufacture an id from a 2xx response.
function extractWahaStatusId(payload, depth = 0) {
  if (depth > 5) return null;
  if (typeof payload === 'string') {
    const id = payload.trim();
    return id && id.length <= 160 && !/[\s\x00-\x1f]/.test(id)
      && !['null', 'undefined', '[object Object]'].includes(id) ? id : null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) {
    if (!payload.length) return null;
    const ids = payload.map(item => extractWahaStatusId(item, depth + 1));
    return ids.every(id => id && id === ids[0]) ? ids[0] : null;
  }
  for (const candidate of [payload._serialized, payload.id, payload.key?.id]) {
    const id = extractWahaStatusId(candidate, depth + 1);
    if (id) return id;
  }
  for (const candidate of [payload._data, payload.data, payload.result, payload.message]) {
    if (!candidate || typeof candidate !== 'object') continue;
    const id = extractWahaStatusId(candidate, depth + 1);
    if (id) return id;
  }
  return null;
}

const WAHA_STATUS_ACCEPTED_MARKER = '[WAHA_ACEITO]';

async function sendWahaStatusMedia({ baseUrl, apiKey, session, type, mediaUrl, caption, timeoutMs, fetchImpl = fetch }) {
  const health = await createWhatsAppStatusHealth({
    env: { WAHA_STATUS_SERVER_URL: baseUrl, WAHA_STATUS_API_KEY: apiKey, WAHA_STATUS_SESSION: session },
    fetchImpl, cacheMs: 0,
  })();
  if (!health.configured) throw statusError('WAHA_STATUS_CONFIGURATION', 'Configuracao WAHA ausente; nenhum Status enviado.');
  if (!health.connected) throw statusError('WAHA_STATUS_PREFLIGHT_UNAVAILABLE', 'Sessao ou leitura dos Status indisponivel; nenhum Status enviado.');
  const endpoint = `${baseUrl}/api/${encodeURIComponent(session)}/status/${type}`;
  let response, bodyText, body;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ file: { url: mediaUrl }, caption, ...(type === 'video' ? { convert: true } : {}) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    bodyText = await response.text();
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }
  } catch {
    throw statusError('WAHA_STATUS_OUTCOME_UNCERTAIN', 'Resultado do Status incerto apos requisicao ao WAHA. Confira o WhatsApp antes de reenviar; repeticao automatica bloqueada.');
  }
  // Server/proxy failures can occur after WhatsApp accepted the publication.
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408) {
      throw statusError('WAHA_STATUS_OUTCOME_UNCERTAIN', `WAHA HTTP ${response.status}: resultado incerto. Confira o WhatsApp antes de reenviar; repeticao automatica bloqueada.`);
    }
    throw statusError('WAHA_STATUS_REJECTED', `WAHA ${type} HTTP ${response.status}: requisicao recusada.`);
  }
  const id = extractWahaStatusId(body);
  if (!id || typeof id !== 'string') {
    // whatsapp-status-no-resend-v1: 2xx sem id = o WAHA aceitou; o marcador impede reenvio automatico na conferencia.
    throw statusError('WAHA_STATUS_OUTCOME_UNCERTAIN', `${WAHA_STATUS_ACCEPTED_MARKER} HTTP ${response.status}: WAHA aceitou o Status mas nao devolveu identificador. Confira o WhatsApp; reenvio automatico bloqueado.`);
  }
  return { endpoint, status: response.status, body, bodyText, id };
}

module.exports = { sendWahaStatusMedia, extractWahaStatusId, WAHA_STATUS_ACCEPTED_MARKER };
