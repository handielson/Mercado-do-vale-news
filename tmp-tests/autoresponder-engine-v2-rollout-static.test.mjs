import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const audit = readFileSync('docs/autoresponder/engine-v2-rollout-audit.md', 'utf8');
const inventory = readFileSync('docs/autoresponder/cleanup-inventory.md', 'utf8');

for (const needle of [
  'Entrega | obrigatorio',
  'Produto | validacao tecnica OK',
  'Compra | validacao tecnica OK',
  'AUTORESPONDER_ENGINE_V2=1',
  "purchaseFlow.status === 'awaiting_customer_document'",
  "purchaseReply.intent === 'purchase_handoff_ready'",
  'tmp-tests/autoresponder-core-scenarios.cjs',
]) {
  assert.ok(audit.includes(needle), `engine rollout audit must include ${needle}`);
}

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const deliveryStart = source.indexOf('async function handleAutoresponderEngineDeliveryFlowV2');
  const productStart = source.indexOf('async function handleAutoresponderEngineProductSearchFlowV2');
  const purchaseStart = source.indexOf('async function handleAutoresponderEnginePurchaseFlowV2');
  assert.ok(deliveryStart >= 0, `${file} must include delivery engine handler`);
  assert.ok(productStart > deliveryStart, `${file} must include product engine handler after delivery`);
  assert.ok(purchaseStart > productStart, `${file} must include purchase engine handler after product`);

  const deliveryBlock = source.slice(deliveryStart, productStart);
  const productBlock = source.slice(productStart, purchaseStart);
  const purchaseBlock = source.slice(purchaseStart, source.indexOf('fastify.', purchaseStart) > 0 ? source.indexOf('fastify.', purchaseStart) : purchaseStart + 12000);

  assert.ok(source.includes('function isAutoresponderEngineV2Enabled()'), `${file} must centralize the engine v2 rollout gate`);
  assert.ok(source.includes("return process.env.AUTORESPONDER_ENGINE_V2 === '1';"), `${file} rollout gate must preserve current env semantics`);
  assert.ok(!deliveryBlock.includes('if (!isAutoresponderEngineV2Enabled()) return null;'), `${file} delivery engine must not be feature-flag gated`);
  assert.ok(productBlock.includes('if (!isAutoresponderEngineV2Enabled()) return null;'), `${file} product engine rollout gate must be explicit until production validation`);
  assert.ok(purchaseBlock.includes('if (!isAutoresponderEngineV2Enabled()) return null;'), `${file} purchase engine rollout gate must be explicit until production validation`);
  assert.ok(source.includes("purchaseReply.intent === 'purchase_handoff_ready'"), `${file} must handle customer document handoff through engine v2`);
  assert.ok(source.includes("purchaseFlow.status === 'awaiting_customer_document'"), `${file} must keep legacy customer document handoff fallback while product/purchase rollout is gated`);
  assert.ok(source.includes('createOrUpdateAutoresponderCustomer('), `${file} must keep customer upsert bridge until handoff migration`);
  assert.ok(source.includes('pauseAutoresponderConversationForPurchase('), `${file} must keep purchase pause side effect until handoff migration`);
}

assert.ok(
  inventory.includes('Remover as flags e os caminhos legados de produto/compra somente depois dessas validacoes'),
  'cleanup inventory must keep the legacy removal blocked by rollout validation',
);

console.log('autoresponder engine v2 rollout static checks passed');
