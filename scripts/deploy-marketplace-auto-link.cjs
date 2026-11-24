'use strict';
// marketplace-auto-link-v1: ligação automática dos anúncios (Shopee MV/PF e ML) pelo SKU, a cada 6 h,
// e envio de estoque também para anúncios duplicados (shopee_stock_extra_links).
// Uso: node deploy-vps-server-only.cjs --marketplace-auto-link-only   (ou --marketplace-auto-link-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'marketplace-auto-link-v1';
const ANCHOR = "fastify.post('/api/marketplace-stock/resync'";
const LOADER_OLD = `    \`SELECT product_id, connection_id, shopee_item_id, shopee_model_id
       FROM shopee_products
      WHERE product_id IN (\${placeholders})
        AND shopee_item_id IS NOT NULL\`,
    productIds
  );`;
const LOADER_NEW = `    \`SELECT product_id, connection_id, shopee_item_id, shopee_model_id
       FROM shopee_products
      WHERE product_id IN (\${placeholders})
        AND shopee_item_id IS NOT NULL\`,
    productIds
  );
  // ${MARK}: anúncios duplicados do mesmo produto na mesma loja também recebem o estoque.
  const [extraLinks] = await pool.query(
    \`SELECT product_id, connection_id, shopee_item_id, NULLIF(shopee_model_id, 0) AS shopee_model_id
       FROM shopee_stock_extra_links WHERE product_id IN (\${placeholders})\`, productIds).catch(() => [[]]);
  if (Array.isArray(rows) && Array.isArray(extraLinks)) rows.push(...extraLinks);`;

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  for (const [a, label] of [[ANCHOR, 'resync route'], [LOADER_OLD, 'shopee stock links loader']]) {
    const n = next.split(a).length - 1;
    if (n !== 1) throw Error(`${label} anchor drift (${n})`);
  }
  next = next.replace(LOADER_OLD, () => LOADER_NEW);
  return next.replace(ANCHOR, () => `// ${MARK}: liga sozinho os anúncios novos pelo SKU (a cada 6 h) e avisa no grupo de vendas.
const marketplaceAutoLinkVps = require('./services/marketplaceAutoLink.cjs').createMarketplaceAutoLink({
  pool, logger: console,
  shopee: async (path, conn, params) => {
    const creds = await getShopeeCatalogCredentialsVps(conn === 'primary' ? '' : conn);
    const r = await shopeeCatalogGetVps(path, creds, encodeShopeeCatalogParamsVps(params));
    if (r?.data?.error) throw new Error(\`Shopee \${path}: \${r.data.message || r.data.error}\`);
    return r?.data || {};
  },
  ml: async (path) => (await require('./services/mercadoLivreServer.cjs').mlRequest(pool, path)).json(),
  resync: (ids) => syncMarketplaceStockAfterLocalMutationVps(ids, 'auto_link'),
  notify: (text) => marketplaceSalesGroupVps.notice(text),
});
marketplaceAutoLinkVps.start();
fastify.post('/api/marketplace-auto-link/run', { preHandler: requireSyncKey }, async () => {
  marketplaceAutoLinkVps.run().catch((e) => console.warn('[auto-link]', e.message));
  return { ok: true, started: true };
});
${ANCHOR}`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/marketplaceAutoLink.cjs', 'services/mercadoLivreServer.cjs'], backupSlug: 'marketplace-auto-link' });
}

module.exports = { patch, deploy, MARK };
