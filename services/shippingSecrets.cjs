'use strict';

// shipping-secrets-v1 (23/11/2026): /shipping/settings é público (o site lê antes de calcular o frete) e devolvia
// os tokens do Melhor Envio e da Frenet; o cálculo rodava no navegador mandando o token para /api/shipping.
// Agora:
// - a leitura pública troca cada token por um marcador ("configurado-no-servidor") e diz se está configurado;
// - /api/shipping usa o token guardado no banco (o do navegador é ignorado quando há token guardado);
// - gerar etiqueta (gasta saldo) exige login de admin.
const TOKEN_PLACEHOLDER = 'configurado-no-servidor';

function publicShippingSettings(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  const meConfigured = Boolean(String(row.melhor_envio_token || '').trim());
  const frenetConfigured = Boolean(String(row.frenet_token || '').trim());
  out.melhor_envio_token = meConfigured ? TOKEN_PLACEHOLDER : '';
  out.frenet_token = frenetConfigured ? TOKEN_PLACEHOLDER : '';
  out.melhor_envio_configured = meConfigured;
  out.frenet_configured = frenetConfigured;
  return out;
}

async function storedShippingTokens(pool) {
  const [rows] = await pool.query('SELECT melhor_envio_token, melhor_envio_sandbox, frenet_token FROM shipping_settings LIMIT 1');
  const row = rows?.[0] || {};
  return {
    melhorEnvio: String(row.melhor_envio_token || '').trim(),
    melhorEnvioSandbox: Number(row.melhor_envio_sandbox || 0) === 1,
    frenet: String(row.frenet_token || '').trim(),
  };
}

async function withStoredShippingToken(pool, query = {}, body = {}) {
  const provider = String(query?.provider || '');
  const next = { ...body };
  if (next.token === TOKEN_PLACEHOLDER) delete next.token;
  if (provider !== 'melhor-envio' && provider !== 'frenet') return next;
  const stored = await storedShippingTokens(pool);
  if (provider === 'melhor-envio' && stored.melhorEnvio) {
    next.token = stored.melhorEnvio;
    next.sandbox = stored.melhorEnvioSandbox;
  }
  if (provider === 'frenet' && stored.frenet) next.token = stored.frenet;
  return next;
}

module.exports = { TOKEN_PLACEHOLDER, publicShippingSettings, storedShippingTokens, withStoredShippingToken };
