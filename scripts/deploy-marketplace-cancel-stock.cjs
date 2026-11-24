'use strict';
// marketplace-cancel-stock-v1: venda cancelada (ML, TikTok, Shopee MV) = pedido Cancelado no Bling (devolve estoque) + aviso no grupo.
// Uso: node deploy-vps-server-only.cjs --marketplace-cancel-stock-only   (ou --marketplace-cancel-stock-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'marketplace-cancel-stock-v1';
const ANCHOR = 'marketplaceAutoLinkVps.start();';

function patch(source) {
  const next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const n = next.split(ANCHOR).length - 1;
  if (n !== 1) throw Error(`auto-link anchor drift (${n})`);
  return next.replace(ANCHOR, () => `${ANCHOR}
// ${MARK}: venda cancelada no marketplace cancela o pedido no Bling (o estoque volta) e avisa no grupo de vendas.
require('./services/marketplaceCancelStock.cjs').createMarketplaceCancelStock({
  pool, logger: console,
  getAuthHeader: () => getBlingProductDetailAuthHeaderVps({ headers: {} }),
  notify: (text) => marketplaceSalesGroupVps.notice(text),
}).start();`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/marketplaceCancelStock.cjs'], backupSlug: 'marketplace-cancel-stock' });
}

module.exports = { patch, deploy, MARK };
