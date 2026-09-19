'use strict';
const assert = require('node:assert/strict');
const { createTikTokFulfillmentAutomation } = require('../services/tiktokShopFulfillmentAutomation.cjs');

async function main() {
  const row = { status: null, last_error: null, updated_at: new Date(0) };
  const pool = { async query(sql) {
    if (sql.startsWith('INSERT IGNORE')) { row.status ||= 'pending'; return [{ affectedRows: 1 }]; }
    if (sql.startsWith('SELECT status')) return [[{ ...row }]];
    if (sql.includes("status='uploading' WHERE") && sql.includes("status='pending'")) {
      if (row.status !== 'pending') return [{ affectedRows: 0 }];
      row.status = 'uploading'; return [{ affectedRows: 1 }];
    }
    if (sql.includes("status='uploaded'")) { if (row.status === 'uploading') row.status = 'uploaded'; return [{ affectedRows: 1 }]; }
    if (sql.includes("status='shipping'")) {
      if (!['pending', 'uploaded'].includes(row.status)) return [{ affectedRows: 0 }];
      row.status = 'shipping'; return [{ affectedRows: 1 }];
    }
    if (sql.includes("status='shipped'")) { row.status = 'shipped'; return [{ affectedRows: 1 }]; }
    return [{ affectedRows: 1 }];
  } };
  let uploads = 0, ships = 0;
  const automation = createTikTokFulfillmentAutomation({ pool,
    uploadOrderInvoice: async () => { uploads += 1; },
    callApi: async (_settings, request) => { assert.equal(request.pathname, '/fulfillment/202309/packages/ship'); ships += 1; return { payload: { data: { errors: [] } } }; },
    loadSettings: async () => ({}), logger: { error() {} } });
  const order = { id: '586142367857673979', status: 'AWAITING_SHIPMENT', need_upload_invoice: 'NEED_INVOICE', packages: [{ id: '586142367857673971' }] };
  await automation.processOrder(order);
  assert.equal(uploads, 1);
  assert.equal(ships, 0, 'do not ship before TikTok confirms invoice');
  await automation.processOrder(order);
  assert.equal(uploads, 1, 'do not upload duplicate invoice');
  await automation.processOrder({ ...order, need_upload_invoice: 'INVOICE_UPLOADED' });
  await automation.processOrder({ ...order, need_upload_invoice: 'INVOICE_UPLOADED' });
  assert.equal(ships, 1);
  await automation.processOrder({ ...order, need_upload_invoice: 'INVOICE_UPLOADED' });
  assert.equal(ships, 1, 'do not ship twice');
  console.log('TikTok fulfillment automation: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
