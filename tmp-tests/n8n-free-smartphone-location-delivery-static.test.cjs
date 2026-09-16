const assert = require('node:assert/strict');
const {
  contactDeliveryAssumptionV401,
  deliveryPolicyCoreV401,
} = require('./n8n-free-smartphone-location-delivery.cjs');

assert.deepEqual(contactDeliveryAssumptionV401('5587999999999@s.whatsapp.net'), {
  ddd: '87', city: 'Petrolina', state: 'PE', label: 'Petrolina-PE',
});
assert.deepEqual(contactDeliveryAssumptionV401('5574999999999@s.whatsapp.net'), {
  ddd: '74', city: 'Juazeiro', state: 'BA', label: 'Juazeiro-BA',
});
assert.equal(contactDeliveryAssumptionV401('5511999999999@s.whatsapp.net').label, '');

assert.equal(deliveryPolicyCoreV401({}, { remoteJid: '5587999999999@s.whatsapp.net', isSmartphone: true }).free, true);
assert.equal(deliveryPolicyCoreV401({}, { remoteJid: '5574999999999@s.whatsapp.net', isSmartphone: true }).free, true);
assert.equal(deliveryPolicyCoreV401({}, { remoteJid: '5587999999999@s.whatsapp.net', isSmartphone: false }).free, false);
assert.equal(deliveryPolicyCoreV401({ city: 'Petrolina', state: 'PE' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free, true);
assert.equal(deliveryPolicyCoreV401({ city: 'Juazeiro', state: 'BA' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free, true);
assert.equal(deliveryPolicyCoreV401({ city: 'Recife', state: 'PE' }, { remoteJid: '5511999999999@s.whatsapp.net', isSmartphone: true }).free, false);

console.log('n8n smartphone location delivery static tests passed');
