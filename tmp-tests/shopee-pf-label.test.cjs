// shopee-pf-label-v1: etiqueta da Shopee G (vendedor PF) so recorta a 1a pagina.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { writeShopeeThermalLabel } = require('../scripts/shopee-auto-print.cjs');

async function twoPagePdf() {
  const doc = await PDFDocument.create();
  for (const text of ['ETIQUETA', 'DACE']) doc.addPage([595, 842]).drawText(text, { x: 40, y: 780, size: 20 });
  return Buffer.from(await doc.save());
}
const pages = async file => (await PDFDocument.load(fs.readFileSync(file))).getPageCount();

test('PF: guarda o original e a etiqueta usa so a 1a pagina', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-label-'));
  const labelPath = path.join(dir, 'G_123_etiqueta-10x15.pdf');
  await writeShopeeThermalLabel({ pdfBuffer: await twoPagePdf(), connection: { id: '9', sellerType: 'individual' }, labelPath });
  assert.equal(await pages(path.join(dir, 'G_123_documento-shopee-original.pdf')), 2);
  assert.equal(await pages(labelPath), 1);
});

test('PJ: sem arquivo original e etiqueta como antes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pj-label-'));
  const labelPath = path.join(dir, '123_etiqueta-10x15.pdf');
  await writeShopeeThermalLabel({ pdfBuffer: await twoPagePdf(), connection: { id: 'primary', sellerType: 'business' }, labelPath });
  assert.ok(fs.existsSync(labelPath));
  assert.equal(fs.readdirSync(dir).length, 1);
});

test('fluxos automatico e manual passam pelo helper', () => {
  const src = fs.readFileSync(path.join(__dirname, '../scripts/shopee-auto-print.cjs'), 'utf8');
  assert.equal((src.match(/await writeShopeeThermalLabel\(/g) || []).length, 2);
});

test('Atualizar servico: npm.cmd roda com shell no Windows (evita spawn EINVAL)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../scripts/shopee-auto-print.cjs'), 'utf8');
  const block = src.slice(src.indexOf('async function pullPrinterServiceUpdate'), src.indexOf('function normalizePrinterNames'));
  assert.match(block, /shell: process\.platform === 'win32'/);
});
