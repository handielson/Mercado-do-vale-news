'use strict';
const assert = require('assert');
const { validateNfeXml, packageFromOrder, shipPackageBody, uploadInvoice } = require('../services/tiktokShopFulfillmentService.cjs');
const xml = Buffer.from('<?xml version="1.0"?><nfeProc><NFe><infNFe/></NFe></nfeProc>');
assert.equal(validateNfeXml(xml).length, xml.length);
assert.throws(() => validateNfeXml(Buffer.from('<html/>')), /XML NF-e/);
assert.deepEqual(packageFromOrder({ id: '586142367857673979', packages: [{ id: 'pkg-1' }] }), { orderId: '586142367857673979', packageId: 'pkg-1', package: { id: 'pkg-1' } });
assert.deepEqual(shipPackageBody('pkg-1'), { packages: [{ id: 'pkg-1', handover_method: 'DROP_OFF' }] });
let jsonArgs;
const uploaded = uploadInvoice({ packageId: 'pkg-1', orderIds: ['586142367857673979'], xml,
  callJson: async args => (jsonArgs = args, { payload: { code: 0 } }) });
uploaded.then(() => {
  assert.equal(jsonArgs.pathname, '/fulfillment/202502/invoice/upload');
  assert.equal(jsonArgs.body.invoices[0].package_id, 'pkg-1');
  assert.deepEqual(jsonArgs.body.invoices[0].order_ids, ['586142367857673979']);
  assert.equal(Buffer.from(jsonArgs.body.invoices[0].file, 'base64').toString(), xml.toString());
  console.log('TikTok fulfillment service tests: OK');
}).catch(error => { console.error(error); process.exitCode = 1; });
