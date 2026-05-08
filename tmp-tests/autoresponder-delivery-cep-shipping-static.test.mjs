import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of serverFiles) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function isAutoresponderFullName',
    'function buildAutoresponderFullNamePrompt',
    "status: 'awaiting_customer_full_name'",
    "intent: 'purchase_customer_full_name_prompt'",
    'async function lookupAutoresponderCep',
    'https://brasilapi.com.br/api/cep/v2/',
    'https://viacep.com.br/ws/',
    'async function calculateAutoresponderShippingOptions',
    'shipping_settings',
    'shipping_zones',
    'shipping_price_ranges',
    "status: 'awaiting_delivery_cep_confirmation'",
    "status: 'awaiting_delivery_number'",
    "intent: 'purchase_delivery_cep_quote'",
    "intent: 'purchase_delivery_number_saved'",
    'shipping_quote',
    'Frete:',
    'Total com frete:',
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  const deliveryFlowIndex = source.indexOf("purchaseFlow.status === 'awaiting_delivery_address'");
  const cepLookupIndex = source.indexOf('lookupAutoresponderCep(cep)', deliveryFlowIndex);
  const shippingCalcIndex = source.indexOf('calculateAutoresponderShippingOptions(cep', cepLookupIndex);
  assert(
    deliveryFlowIndex >= 0 &&
      deliveryFlowIndex < cepLookupIndex &&
      cepLookupIndex < shippingCalcIndex,
    `${fileName} must look up CEP before calculating shipping`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
[
  'Fase 4M nome completo, CEP e frete dinamico',
  '- [x] Nome completo obrigatorio antes de finalizar pedido assistido',
  '- [x] Entrega pede CEP, consulta endereco e pede somente numero/complemento',
  '- [x] Frete dinamico entra no resumo/confirmacao antes de chamar atendente',
  'tmp-tests/autoresponder-delivery-cep-shipping-static.test.mjs',
].forEach((needle) => {
  assert(doc.includes(needle), `Bot_Whatsapp.md must document CEP/shipping flow: ${needle}`);
});

console.log('autoresponder delivery CEP and shipping static checks passed');
