const assert = require('node:assert/strict');
const {
  deliveryPolicyCoreV163,
  cepResolverCode,
  deliveryPolicyCode,
} = require('./n8n-fix-delivery-address-confirmation.cjs');

const petrolinaUrban = {
  cep: '56304240',
  street: 'Rua Engenheiro Walmir Bezerra',
  neighborhood: 'Centro',
  city: 'Petrolina',
  state: 'PE',
};
const juazeiroUrban = { street: 'Rua A', neighborhood: 'Centro', city: 'Juazeiro', state: 'BA' };
const petrolinaRural = { neighborhood: 'Projeto Nilo Coelho', city: 'Petrolina', state: 'PE' };

assert.deepEqual(
  { free: deliveryPolicyCoreV163(petrolinaUrban, 19901).free, status: deliveryPolicyCoreV163(petrolinaUrban, 19901).status },
  { free: true, status: 'free' },
  'Petrolina urban must be free only above R$ 199.00',
);
assert.equal(deliveryPolicyCoreV163(petrolinaUrban, 19900).free, false, 'R$ 199.00 exactly is not above the threshold');
assert.equal(deliveryPolicyCoreV163(juazeiroUrban, 20000).free, true, 'Juazeiro urban above threshold must be free');
assert.equal(deliveryPolicyCoreV163(petrolinaRural, 50000).free, false, 'Rural Petrolina must require review');
assert.equal(deliveryPolicyCoreV163({ city: 'Recife', state: 'PE' }, 50000).free, false, 'Other cities must require review');
assert.equal(deliveryPolicyCoreV163(petrolinaUrban, 0).status, 'needs_review', 'Unknown purchase total must not quote freight');
assert.equal(deliveryPolicyCoreV163(petrolinaUrban, 0).customerShareCents, null, 'Unknown freight must not become zero or a charge');

const remoteJid = '558791396488@s.whatsapp.net';
const staticData = {
  salesPostList: {
    [remoteJid]: {
      step: 'awaiting_delivery_zip',
      orderDraft: { fulfillment: 'delivery' },
    },
  },
};
const source = { remoteJid, deliveryCep: '56304240' };
const lookup = () => ({ first: () => ({ json: source }) });
const response = {
  cep: '56304-240',
  logradouro: 'Rua Engenheiro Walmir Bezerra',
  bairro: 'Centro',
  localidade: 'Petrolina',
  uf: 'PE',
};
const resolverResult = new Function('$', '$json', '$getWorkflowStaticData', cepResolverCode)(
  lookup,
  response,
  () => staticData,
)[0].json;
assert.equal(resolverResult.salesPostListStep, 'awaiting_delivery_address_confirmation');
assert.equal(staticData.salesPostList[remoteJid].step, 'awaiting_delivery_address_confirmation');
assert.equal(staticData.salesPostList[remoteJid].orderDraft.deliveryAddressConfirmed, false);
assert.match(resolverResult.output, /Rua Engenheiro Walmir Bezerra/);
assert.match(resolverResult.output, /Centro/);
assert.match(resolverResult.output, /Petrolina\/PE/);
assert.match(resolverResult.output, /Esse endereco confere\?/);
assert.doesNotMatch(resolverResult.output, /R\$|frete|taxa|gratis/i, 'CEP lookup must not quote freight before address confirmation');

const policyOutput = new Function('$json', deliveryPolicyCode)({})[0].json.output;
assert.match(policyOutput, /primeiro localizo o CEP e confirmo o endereco/i);
assert.match(policyOutput, /acima de R\$ 199,00/);
assert.match(policyOutput, /Nenhum valor e informado antes disso/);
assert.doesNotMatch(policyOutput, /R\$ 50|motoboy|divide com o cliente/i);

console.log(JSON.stringify({ passed: 18, cep: resolverResult.output, policy: policyOutput }, null, 2));
