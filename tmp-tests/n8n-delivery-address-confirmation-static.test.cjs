const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  contactDeliveryAssumptionV401,
  deliveryPolicyCoreV401,
} = require('./n8n-free-smartphone-location-delivery.cjs');

const petrolina = contactDeliveryAssumptionV401('558791396488@s.whatsapp.net');
const juazeiro = contactDeliveryAssumptionV401('5574999999999@s.whatsapp.net');
assert.equal(petrolina.label, 'Petrolina-PE');
assert.equal(juazeiro.label, 'Juazeiro-BA');

assert.equal(
  deliveryPolicyCoreV401({}, { remoteJid: '558791396488@s.whatsapp.net', isSmartphone: true }).free,
  true,
  'Smartphone delivery must be free for DDD 87 without a minimum order value',
);
assert.equal(
  deliveryPolicyCoreV401({}, { remoteJid: '5574999999999@s.whatsapp.net', isSmartphone: true }).free,
  true,
  'Smartphone delivery must be free for DDD 74 without a minimum order value',
);
assert.equal(
  deliveryPolicyCoreV401({}, { remoteJid: '558791396488@s.whatsapp.net', isSmartphone: false }).free,
  false,
  'The automatic free-delivery rule must remain exclusive to smartphones',
);
assert.equal(
  deliveryPolicyCoreV401({ city: 'Petrolina', state: 'PE' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free,
  true,
  'A confirmed Petrolina address must also qualify a smartphone',
);
assert.equal(
  deliveryPolicyCoreV401({ city: 'Juazeiro', state: 'BA' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free,
  true,
  'A confirmed Juazeiro address must also qualify a smartphone',
);
assert.equal(
  deliveryPolicyCoreV401({ city: 'Recife', state: 'PE' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free,
  false,
  'Other cities must require delivery review',
);

const patchSource = readFileSync(require.resolve('./n8n-free-smartphone-location-delivery.cjs'), 'utf8');
for (const required of [
  'awaiting_delivery_neighborhood',
  'awaiting_delivery_location',
  'awaiting_delivery_address_confirmation',
  'awaiting_delivery_address_text',
  'inboundLocation',
  'nominatim.openstreetmap.org/reverse',
  '© OpenStreetMap contributors',
]) assert.equal(patchSource.includes(required), true, `Missing ${required}`);

assert.doesNotMatch(deliveryPolicyCoreV401.toString(), /19900|threshold|orderTotal/);

console.log('n8n delivery address confirmation tests passed');
