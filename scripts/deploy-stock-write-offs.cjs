'use strict';
// stock-write-off-v1: rotas /stock-write-offs (baixa administrativa com saída no Bling).
// Uso: node deploy-vps-server-only.cjs --stock-write-offs-only   (ou --stock-write-offs-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'stock-write-off-v1';
const ANCHOR = "fastify.post('/stock-locations/adjustments', { preHandler: requireSyncKey }, async (req) => {";

const BLOCK = `// ${MARK}: baixa administrativa (avaria, uso na loja, brinde, perda) — saída no Bling com motivo e responsável.
require('./services/stockWriteOffs.cjs').createStockWriteOffs({
  pool,
  getBlingAuthHeader: () => getBlingProductDetailAuthHeaderVps({ headers: {} }),
  syncProductStock,
  syncMarketplaceStock: syncMarketplaceStockAfterLocalMutationVps,
  getDefaultCompanyId: getDefaultStockCompanyId,
}).register(fastify, { preHandler: requireSyncKeyOrAdmin });

`;

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const n = next.split(ANCHOR).length - 1;
  if (n !== 1) throw Error(`${MARK}: âncora das rotas de estoque (${n})`);
  return next.replace(ANCHOR, () => BLOCK + ANCHOR);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/stockWriteOffs.cjs'], backupSlug: 'stock-write-offs' });
}

module.exports = { patch, deploy, MARK };
