'use strict';
// marketplace-stock-resync-v1: POST /api/marketplace-stock/resync {product_ids} manda o estoque atual desses produtos
// para todos os anúncios ligados (Shopee MV/G, TikTok, Mercado Livre). Usado depois de ligar anúncios em massa.
// Uso: node deploy-vps-server-only.cjs --marketplace-stock-resync-only   (ou --marketplace-stock-resync-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'marketplace-stock-resync-v1';
const ANCHOR = 'shopeeGStockVps.start();';

function patch(source) {
  const next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const n = next.split(ANCHOR).length - 1;
  if (n !== 1) throw Error(`shopee-g-stock anchor drift (${n})`);
  return next.replace(ANCHOR, () => `${ANCHOR}
// ${MARK}: reenvia o estoque do sistema aos anúncios ligados (só estoque, nunca preço).
fastify.post('/api/marketplace-stock/resync', { preHandler: requireSyncKey }, async (request, reply) => {
  const ids = [...new Set((Array.isArray(request.body?.product_ids) ? request.body.product_ids : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || ids.length > 100) return reply.code(400).send({ error: 'Envie de 1 a 100 product_ids.' });
  return syncMarketplaceStockAfterLocalMutationVps(ids, 'manual_resync');
});`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: [], backupSlug: 'marketplace-stock-resync' });
}

module.exports = { patch, deploy, MARK };
