import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function shouldAutoresponderRuleAwaitStandaloneDeliveryCep',
    'async function handleAutoresponderStandaloneDeliveryCepLookup',
    "status: 'awaiting_standalone_delivery_cep'",
    "'standalone_delivery_cep_prompt'",
    "intent: 'standalone_delivery_cep_quote'",
    'calculateAutoresponderShippingOptions(normalizedCep, [], cepAddress)',
    "SELECT * FROM shipping_price_ranges",
    "Object.prototype.hasOwnProperty.call(range, 'min_km')",
    'Atendemos esse CEP',
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  const shippingCalcMatch = source.match(/async function calculateAutoresponderShippingOptions[\s\S]*?\n\}/);
  assert(shippingCalcMatch, `${fileName} must include calculateAutoresponderShippingOptions`);
  assert(
    !shippingCalcMatch[0].includes('ORDER BY min_km ASC'),
    `${fileName} autoresponder shipping calculation must tolerate legacy price range schemas without min_km`
  );

  const loadFlowIndex = source.indexOf('const purchaseFlow = await getAutoresponderPurchaseFlow(senderKey)');
  const standaloneBranchIndex = source.indexOf("purchaseFlow.status === 'awaiting_standalone_delivery_cep'", loadFlowIndex);
  const cartDeliveryIndex = source.indexOf("purchaseFlow.status === 'awaiting_delivery_address'", loadFlowIndex);
  assert(
    standaloneBranchIndex > loadFlowIndex && standaloneBranchIndex < cartDeliveryIndex,
    `${fileName} must handle standalone delivery CEP before cart-only delivery flow`
  );

  const ruleTextIndex = source.indexOf("intent: 'rule_text'");
  const shouldAwaitIndex = source.indexOf('shouldAutoresponderRuleAwaitStandaloneDeliveryCep(matchedRule, resolvedRuleText)', ruleTextIndex);
  const saveFlowIndex = source.indexOf("status: 'awaiting_standalone_delivery_cep'", shouldAwaitIndex);
  assert(
    ruleTextIndex >= 0 && shouldAwaitIndex > ruleTextIndex && saveFlowIndex > shouldAwaitIndex,
    `${fileName} must arm standalone CEP lookup after a delivery rule asks for CEP`
  );
}

console.log('autoresponder standalone delivery CEP static checks passed');
