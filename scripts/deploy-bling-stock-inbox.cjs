'use strict';
// bling-stock-inbox-v2: motivo real do erro no aviso de estoque do Bling + desiste após 40 tentativas e avisa no grupo.
// Uso: node deploy-vps-server-only.cjs --bling-stock-inbox-only   (ou --bling-stock-inbox-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'bling-stock-inbox-v2';
const one = (src, anchor) => { const n = src.split(anchor).length - 1; if (n !== 1) throw Error(`${MARK}: âncora "${anchor.slice(0, 50)}" (${n})`); };

const DESCRIBE = `// ${MARK}: diz qual parte recusou (MdV, Shopee, TikTok, ML) em vez de "Stock processing failed".
function describeBlingStockFailureVps(vpsStockResult, marketplaceStockSync, blingId) {
  const parts = [];
  if (!vpsStockResult?.ok) {
    const why = vpsStockResult?.error || vpsStockResult?.message || vpsStockResult?.reason || (vpsStockResult?.status ? \`HTTP \${vpsStockResult.status}\` : '');
    const targets = Array.isArray(vpsStockResult?.stockTargets) ? vpsStockResult.stockTargets.length : 0;
    parts.push(\`MdV: \${why || (targets ? 'falhou' : \`produto do Bling \${blingId} não está cadastrado no MdV\`)}\`);
  }
  const sides = [['Shopee', marketplaceStockSync?.shopee], ['TikTok', marketplaceStockSync?.tiktok], ['ML', marketplaceStockSync?.mercadoLivre]];
  for (const [name, side] of sides) {
    if (!side || side.ok) continue;
    const errs = (side.errors || []).slice(0, 3).map((e) => [e.connection_id && e.connection_id !== 'primary' ? \`loja \${String(e.connection_id).slice(0, 8)}\` : '', e.item_id || e.itemId || e.productId || '', e.error || '', e.message || '', (e.failure_list || []).map((f) => f.failed_reason || f.reason || JSON.stringify(f)).join('; ')].filter(Boolean).join(' '));
    parts.push(\`\${name}: \${errs.join(' | ') || side.error || side.skipped || 'falhou'}\`);
  }
  return parts.join(' · ').slice(0, 990) || 'Stock processing failed';
}

`;

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const A1 = '        ok: Boolean(vpsStockResult.ok && marketplaceStockSync.ok),\n';
  const A2 = 'async function handleBlingWebhookVps(request, reply) {';
  const A3 = 'const blingStockWebhookQueue = createBlingStockWebhookQueue({\n  pool,\n';
  const A4 = 'marketplaceSalesGroupVps.register(fastify, { requireSyncKey, requireAdminBearerToken });';
  for (const a of [A1, A2, A3, A4]) one(next, a);
  next = next.replace(A1, () => `${A1}        error: (vpsStockResult.ok && marketplaceStockSync.ok) ? undefined : describeBlingStockFailureVps(vpsStockResult, marketplaceStockSync, blingId), // ${MARK}\n`);
  next = next.replace(A2, () => DESCRIBE + A2);
  next = next.replace(A3, () => `${A3}  maxAttempts: 40, // ${MARK}\n  notify: (text) => marketplaceSalesGroupVps.notice(text),\n`);
  next = next.replace(A4, () => `${A4}\nblingStockWebhookQueue.register(fastify, { requireAdminBearerToken }); // ${MARK}`);
  return next;
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/blingStockWebhookQueue.cjs'], backupSlug: 'bling-stock-inbox' });
}

module.exports = { patch, deploy, MARK };
