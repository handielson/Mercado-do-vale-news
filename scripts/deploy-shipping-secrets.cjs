'use strict';
// shipping-secrets-v1: tokens de frete fora da leitura pública; /api/shipping usa o token do banco; etiqueta só com admin.
// Uso: node deploy-vps-server-only.cjs --shipping-secrets-only   (ou --shipping-secrets-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'shipping-secrets-v1';

function once(src, a, b, label) {
  const n = src.split(a).length - 1;
  if (n !== 1) throw Error(`${label} anchor drift (${n})`);
  return src.replace(a, () => b);
}

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  next = once(next, "  return row;\n});\n\nfastify.patch('/shipping/settings'",
    `  // ${MARK}: leitura pública sem os tokens do Melhor Envio e da Frenet.\n  return require('./services/shippingSecrets.cjs').publicShippingSettings(row);\n});\n\nfastify.patch('/shipping/settings'`, 'GET settings');
  next = once(next, 'melhor_envio_token=COALESCE(?,melhor_envio_token)',
    "melhor_envio_token=COALESCE(NULLIF(NULLIF(?,''),'configurado-no-servidor'),melhor_envio_token)", 'PATCH ME token');
  next = once(next, 'frenet_token=COALESCE(?,frenet_token)',
    "frenet_token=COALESCE(NULLIF(NULLIF(?,''),'configurado-no-servidor'),frenet_token)", 'PATCH Frenet token');
  next = once(next, '    const result = await handleShippingApiVps(request.query, request.body || {});',
    [`    // ${MARK}: token do banco (o do navegador é ignorado); etiqueta gasta saldo → só admin.`,
      "    if (String(request.query?.action || '') === 'label' && !(await isAdminBearerToken(request))) {",
      "      return reply.code(401).send({ error: 'Entre como admin para gerar etiqueta.' });",
      '    }',
      "    const shippingBodyV1 = await require('./services/shippingSecrets.cjs').withStoredShippingToken(pool, request.query, request.body || {});",
      '    const result = await handleShippingApiVps(request.query, shippingBodyV1);'].join('\n'), 'api/shipping');
  return next;
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/shippingSecrets.cjs'], backupSlug: 'shipping-secrets' });
}

module.exports = { patch, deploy, MARK };
