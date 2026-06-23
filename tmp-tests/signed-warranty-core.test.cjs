const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSaleCode,
  parseSignedWarrantyFileName,
  buildSignedWarrantyNames,
  buildDiscardMessage,
  fitImageInsideA4,
} = require('../services/signedWarrantyDocumentCore.cjs');

test('normalizes the visible eight-character sale code', () => {
  assert.equal(normalizeSaleCode(' ab12-cd34 '), 'AB12CD34');
});

test('accepts only direct Synology source image names', () => {
  assert.deepEqual(parseSignedWarrantyFileName('termo-garantia-venda-ab12cd34.png'), {
    saleCode: 'AB12CD34',
    extension: 'png',
  });
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-ab12cd34.pdf'), null);
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-abcdefghX.jpg'), null);
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-abcdefghij.png'), null);
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-ab12-cd34.jpeg'), null);
  assert.equal(parseSignedWarrantyFileName('foto.jpg'), null);
});

test('builds canonical original and PDF names', () => {
  assert.deepEqual(buildSignedWarrantyNames('ab12cd34'), {
    imageName: 'termo-garantia-venda-AB12CD34-original.jpg',
    pdfName: 'termo-garantia-venda-AB12CD34.pdf',
  });
});

test('builds the approved screen-only disposal message', () => {
  assert.equal(
    buildDiscardMessage(new Date('2026-06-23T18:30:00-03:00'), 'pt-BR', 'America/Sao_Paulo'),
    'Documento físico digitalizado, destruído e descartado em 23/06/2026 às 18:30.'
  );
});

test('fits portrait and landscape images inside A4 without cropping', () => {
  const portrait = fitImageInsideA4(1200, 1800, 595.28, 841.89, 24);
  assert.ok(portrait.width <= 547.28 && portrait.height <= 793.89);
  const landscape = fitImageInsideA4(1800, 1200, 595.28, 841.89, 24);
  assert.ok(landscape.width <= 547.28 && landscape.height <= 793.89);
});
