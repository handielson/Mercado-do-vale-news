'use strict';
// product-materials-v1: registra /admin/product-materials (lista de materiais do campo "Material" do produto).
// Uso: node deploy-vps-server-only.cjs --product-materials-only   (ou --product-materials-check)
const openAiFinance = require('./deploy-openai-finance.cjs');
const MARK = 'product-materials-v1';
const ANCHOR = "require('./services/openAiFinanceServer.cjs').registerOpenAiFinanceRoutes(fastify, { pool, requireAdminBearerToken });";

function patch(source) {
  const next = String(source).replace(/\r\n/g, '\n');
  if (next.includes(MARK)) return next;
  const n = next.split(ANCHOR).length - 1;
  if (n !== 1) throw Error(`openAiFinance anchor drift (${n})`);
  return next.replace(ANCHOR, () => `${ANCHOR}\n// ${MARK}: materiais do campo "Material" do produto (PLA, PETG, TPU, ASA... e os que o admin cadastrar).\nrequire('./services/productMaterialsServer.cjs').registerProductMaterialRoutes(fastify, { pool, requireAdminBearerToken });`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/productMaterialsServer.cjs'], backupSlug: 'product-materials' });
}

module.exports = { patch, deploy, MARK };
