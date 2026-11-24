'use strict';
// shopee-g-stock-v1: baixa de estoque no Bling das vendas da loja Shopee PF + SKU de anúncio sem variação (item_sku).
// Uso: node deploy-vps-server-only.cjs --shopee-g-stock-only   (ou --shopee-g-stock-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'shopee-g-stock-v1';
const ANCHOR = 'marketplaceSalesGroupVps.start();';
const SKU_OLD = '      || item?.model_sku\n';
const SKU_NEW = '      || item?.model_sku\n      || item?.item_sku // shopee-g-stock-v1: anúncio sem variação traz o SKU aqui\n';

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  for (const [a, label] of [[ANCHOR, 'group start'], [SKU_OLD, 'sale item sku']]) {
    const n = next.split(a).length - 1;
    if (n !== 1) throw Error(`${label} anchor drift (${n})`);
  }
  next = next.replace(SKU_OLD, () => SKU_NEW);
  return next.replace(ANCHOR, () => `${ANCHOR}
// ${MARK}: venda paga da loja Shopee PF = saída no Bling; cancelada = entrada. Erro avisa no grupo de vendas.
const shopeeGStockVps = require('./services/shopeeIndividualStock.cjs').createShopeeIndividualStock({
  pool, logger: console, liveSince: Date.parse('2026-11-24T13:00:00Z'), // antes disso = retroativo (30 dias)
  getAuthHeader: () => getBlingProductDetailAuthHeaderVps({ headers: {} }),
  notify: (text) => marketplaceSalesGroupVps.notice(text),
});
shopeeGStockVps.start();`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/shopeeIndividualStock.cjs', 'services/marketplaceSalesGroup.cjs'], backupSlug: 'shopee-g-stock' });
}

module.exports = { patch, deploy, MARK };
