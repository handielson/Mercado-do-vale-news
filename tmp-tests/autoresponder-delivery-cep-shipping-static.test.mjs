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
    'async function handleAutoresponderDeliveryNumberInput',
    "intent: 'purchase_delivery_number_saved'",
    'shipping_quote',
    'Frete:',
    'Se estiver correto, me envie o numero da casa',
    'Se tiver complemento, pode mandar junto',
    'Total com frete:',
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  const deliveryFlowIndex = source.indexOf("purchaseFlow.status === 'awaiting_delivery_address'");
  const helperIndex = source.indexOf('async function handleAutoresponderDeliveryCepLookup');
  const cepLookupIndex = source.indexOf('lookupAutoresponderCep(normalizedCep)', helperIndex);
  const shippingCalcIndex = source.indexOf('calculateAutoresponderShippingOptions(normalizedCep', cepLookupIndex);
  const deliveryHandlerCallIndex = source.indexOf('handleAutoresponderDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep })', deliveryFlowIndex);
  const confirmationIndex = source.indexOf("purchaseFlow.status === 'awaiting_delivery_cep_confirmation'");
  const directNumberIndex = source.indexOf('handleAutoresponderDeliveryNumberInput({ senderKey, message, purchaseFlow, settings })', confirmationIndex);
  const yesIndex = source.indexOf('isAutoresponderYes(message)', confirmationIndex);
  assert(
    deliveryFlowIndex >= 0 &&
      helperIndex >= 0 &&
      cepLookupIndex > helperIndex &&
      cepLookupIndex < shippingCalcIndex &&
      deliveryHandlerCallIndex > deliveryFlowIndex,
    `${fileName} must look up CEP before calculating shipping through the shared delivery handler`
  );

  assert(
    confirmationIndex >= 0 &&
      directNumberIndex > confirmationIndex &&
      directNumberIndex < yesIndex,
    `${fileName} must accept house number/complement directly after CEP confirmation before requiring "sim"`
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
