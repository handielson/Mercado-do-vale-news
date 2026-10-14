const { createWhatsAppStatusHealth } = require('./whatsappStatusHealth.cjs');

function statusError(code, message) {
  return Object.assign(new Error(message), { code });
}

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
  const id = typeof body?.id === 'string' ? body.id.trim() : body?.id?._serialized || body?.key?.id;
  if (!id || typeof id !== 'string') {
    throw statusError('WAHA_STATUS_OUTCOME_UNCERTAIN', 'WAHA respondeu sem identificador do Status. Confira o WhatsApp antes de reenviar; repeticao automatica bloqueada.');
  }
  return { endpoint, status: response.status, body, bodyText, id };
}

module.exports = { sendWahaStatusMedia };
