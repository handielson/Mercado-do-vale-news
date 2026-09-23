'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument, decodePDFRawStream } = require('pdf-lib');
const { executeTikTokPrintJob, startTikTokPrintAgent, separationLocation, listWindowsPrinters, tiktokSummaryHeightMm } = require('../scripts/tiktok-shop-print-agent.cjs');
const { summaryFromOrder, isPrintableOrder } = require('../services/tiktokShopPrintServer.cjs');

async function main() {
  assert.equal(tiktokSummaryHeightMm([{}]), 70);
  assert.equal(tiktokSummaryHeightMm([{}, {}]), 80);
  assert.equal(tiktokSummaryHeightMm([{}, {}, {}]), 90);
  assert.equal(tiktokSummaryHeightMm([{}, {}, {}, {}]), 90);
  const branded = await require('../scripts/mercado-livre-print-core.cjs').createMercadoLivreSummaryPdf({
    marketplaceName: 'TIKTOK SHOP', orderSn: '586215533660637149', buyerName: 'Cliente TikTok',
    trackingNumber: 'BR123456789', items: [{ name: 'Produto TikTok', sku: 'TK-1', quantity: 1 }],
  }, { pageHeightMm: 70 });
  const brandedPdf = await PDFDocument.load(branded);
  assert.ok(Math.abs(brandedPdf.getPage(0).getHeight() - 70 * 72 / 25.4) < 0.01);
  const pageContents = brandedPdf.context.lookup(brandedPdf.getPage(0).node.Contents());
  const brandedContent = Array.from({ length: pageContents.size() }, (_, index) =>
    Buffer.from(decodePDFRawStream(brandedPdf.context.lookup(pageContents.get(index))).decode()).toString()).join('');
  assert.ok(brandedContent.includes(Buffer.from('TIKTOK SHOP - SEPARACAO').toString('hex').toUpperCase()));
  assert.ok(brandedContent.includes(Buffer.from('586215533660637149').toString('hex').toUpperCase()));
  assert.ok(!brandedContent.includes(Buffer.from('MERCADO LIVRE - SEPARACAO').toString('hex').toUpperCase()));
  const listed = await listWindowsPrinters(async (file, args, options) => {
    assert.equal(file, 'powershell.exe');
    assert.ok(args.includes('Get-Printer | Select-Object -ExpandProperty Name'));
    assert.equal(options.timeout, 10000);
    return { stdout: 'ZDesigner ZD220-203dpi ZPL\r\nComprovante\r\n' };
  });
  assert.deepEqual(listed, [{ name: 'ZDesigner ZD220-203dpi ZPL' }, { name: 'Comprovante' }]);
  await assert.rejects(listWindowsPrinters(async () => { throw new Error('spooler unavailable'); }), /spooler unavailable/);
  let claims = 0;
  const settings = { shopee_printer_thermal: 'Zebra', shopee_printer_a4: 'Comprovante' };
  const wrongComputer = startTikTokPrintAgent({ syncKey: 'test', getSettings: async () => settings,
    listPrinters: async () => [{ name: 'P50 Printer' }], request: async () => { claims++; return null; },
    logger: { log() {}, warn() {}, error() {} }, intervalMs: 60000 });
  try {
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(claims, 0, 'a machine without configured printers must not claim a live TikTok job');
  } finally { wrongComputer.stop(); }
  const rightComputer = startTikTokPrintAgent({ syncKey: 'test', getSettings: async () => settings,
    listPrinters: async () => [{ name: 'Zebra' }, { name: 'Comprovante' }],
    request: async () => { claims++; return null; },
    logger: { log() {}, warn() {}, error() {} }, intervalMs: 60000 });
  try {
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(claims, 1, 'the configured print computer should claim the job');
  } finally { rightComputer.stop(); }
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
      prepareSummaryPrinter: async (printer, width, height) => ({ printer, width, height }),
      directory: path.join(root, 'pdf'), journalDirectory: path.join(root, 'journal'),
      logger: { log() {} } };
    await executeTikTokPrintJob(args);
    await executeTikTokPrintJob(args);
    assert.deepEqual(steps, ['label', 'summary', 'label', 'summary']);
    assert.equal(calls.length, 2, 'ack retry must not print duplicate sheets');
    assert.equal(calls[0].options.printer, 'Zebra');
    assert.deepEqual(calls[1].options, { printer: 'Comprovante', width: 90, height: 70, orientation: 'landscape' });
    const summaryPdf = await PDFDocument.load(fs.readFileSync(calls[1].file));
    assert.equal(summaryPdf.getPageCount(), 1);
    assert.ok(Math.abs(summaryPdf.getPage(0).getHeight() - 70 * 72 / 25.4) < 0.01);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  console.log('TikTok auto print: OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
