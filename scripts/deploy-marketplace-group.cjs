'use strict';
// marketplace-sales-group-v1: grupo do WhatsApp com as vendas dos marketplaces e o resultado das etiquetas.
// Uso: node deploy-vps-server-only.cjs --marketplace-group-only   (ou --marketplace-group-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'marketplace-sales-group-v1';
const ANCHOR = 'setInterval(() => marketplaceSalesStoreVps.syncInBackgroundIfStale(), 2 * 60_000).unref?.();';

function patch(source) {
  const next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const n = next.split(ANCHOR).length - 1;
  if (n !== 1) throw Error(`marketplace sales anchor drift (${n})`);
  return next.replace(ANCHOR, () => `${ANCHOR}
// ${MARK}: vendas novas e etiquetas (ok/erro com motivo) no grupo "Vendas Marketplaces MdV" do WhatsApp.
const marketplaceSalesGroupVps = require('./services/marketplaceSalesGroup.cjs').createMarketplaceSalesGroup({ pool, logger: console });
marketplaceSalesGroupVps.register(fastify, { requireSyncKey, requireAdminBearerToken });
marketplaceSalesGroupVps.start();`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/marketplaceSalesGroup.cjs'], backupSlug: 'marketplace-group' });
}

module.exports = { patch, deploy, MARK };
