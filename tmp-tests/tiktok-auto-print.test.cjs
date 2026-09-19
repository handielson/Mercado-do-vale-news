'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { executeTikTokPrintJob, separationLocation } = require('../scripts/tiktok-shop-print-agent.cjs');
const { summaryFromOrder, isPrintableOrder } = require('../services/tiktokShopPrintServer.cjs');

async function main() {
  const order = { id: '586142367857673979', status: 'AWAITING_COLLECTION', create_time: 1789800000,
    recipient_address: { name: 'Cliente' }, line_items: [{ product_name: 'Produto teste', seller_sku: 'ABC-1', quantity: 2 }],
    packages: [{ id: '586142367857673971' }] };
  assert.equal(isPrintableOrder(order), true);
  assert.equal(isPrintableOrder({ ...order, status: 'CANCELLED' }), false);
  const summary = summaryFromOrder(order, order.packages[0].id, 'BR123456789');
  assert.equal(summary.items[0].sku, 'ABC-1');
  assert.equal(separationLocation('Loja Principal / Estoque Geral | Deposito / Caixa 70 | Deposito / Entrada / Conferencia'), 'Deposito / Caixa 70');
  const pdf = await PDFDocument.create();
  pdf.addPage([288, 432]);
  const label = Buffer.from(await pdf.save());
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-tiktok-print-'));
  const calls = [];
  const steps = [];
  const job = { packageId: order.packages[0].id, orderId: order.id, summary };
  const request = async (route, options = {}) => {
    if (route.endsWith('/label')) return label;
    if (route.endsWith('/step')) steps.push(options.body.step);
    return { ok: true };
  };
  try {
    const args = { job, settings: { shopee_printer_thermal: 'Zebra', shopee_printer_a4: 'Comprovante' },
      request, print: async (file, options) => calls.push({ file, options }),
      getStockLocations: async () => ({ 'ABC-1': 'Prateleira A3' }),
      prepareSummaryPrinter: async printer => ({ printer, paperSize: '90x100' }),
      directory: path.join(root, 'pdf'), journalDirectory: path.join(root, 'journal'),
      logger: { log() {} } };
    await executeTikTokPrintJob(args);
    await executeTikTokPrintJob(args);
    assert.deepEqual(steps, ['label', 'summary', 'label', 'summary']);
    assert.equal(calls.length, 2, 'ack retry must not print duplicate sheets');
    assert.equal(calls[0].options.printer, 'Zebra');
    assert.equal(calls[1].options.paperSize, '90x100');
    assert.equal((await PDFDocument.load(fs.readFileSync(calls[1].file))).getPageCount(), 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  console.log('TikTok auto print: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
