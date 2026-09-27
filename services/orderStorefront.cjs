'use strict';

// Pedidos anteriores à separação de canais pertencem ao Mercado do Vale.
// Qualquer origem nova ou desconhecida deve falhar fechada nas automações da marca.
function canUseMercadoDoValeOrderAutomation(order) {
  return Boolean(order?.id) && (order.storefront == null || order.storefront === 'mercado_do_vale');
}

function isLegacyMdvOrderCreate(input) {
  return input && typeof input === 'object' && !Array.isArray(input)
    && (!Object.hasOwn(input, 'storefront') || input.storefront === 'mercado_do_vale');
}

function isLegacyMdvOrderPatch(input) {
  return input && typeof input === 'object' && !Array.isArray(input)
    && !Object.hasOwn(input, 'storefront');
}

module.exports = { canUseMercadoDoValeOrderAutomation, isLegacyMdvOrderCreate, isLegacyMdvOrderPatch };
