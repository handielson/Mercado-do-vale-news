'use strict';
// bot-focus-product-v1: rotas /admin/bot-focus-product e marca bot_focus na lista GET /products.
// Uso: node deploy-vps-server-only.cjs --bot-focus-product-only   (ou --bot-focus-product-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'bot-focus-product-v1';
const ROUTE_ANCHOR = "require('./services/openAiFinanceServer.cjs').registerOpenAiFinanceRoutes(fastify, { pool, requireAdminBearerToken });";
const LIST_OLD = '  return attachCatalogModelColorImages(result, buildSeoBaseUrl(req));\n\n});';

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  for (const [a, label] of [[ROUTE_ANCHOR, 'route'], [LIST_OLD, 'products list']]) {
    const n = next.split(a).length - 1;
    if (n !== 1) throw Error(`${label} anchor drift (${n})`);
  }
  next = next.replace(ROUTE_ANCHOR, () => `${ROUTE_ANCHOR}
// ${MARK}: "celular em foco" do robô (estrela no card do produto).
const botFocusProductVps = require('./services/botFocusProduct.cjs').createBotFocusProduct({ pool });
botFocusProductVps.register(fastify, { requireAdminBearerToken });`);
  return next.replace(LIST_OLD, () => `  await botFocusProductVps.mark(result); // ${MARK}
  return attachCatalogModelColorImages(result, buildSeoBaseUrl(req));

});`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/botFocusProduct.cjs'], backupSlug: 'bot-focus-product' });
}

module.exports = { patch, deploy, MARK };
