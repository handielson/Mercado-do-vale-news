'use strict';

// Lê de verdade: gera uma "etiqueta" com IMEIs em Code128 e EAN-13, fotografada pequena,
// e confere que o leitor (com blocos ampliados) encontra os três códigos.
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { writeBarcode } = require('zxing-wasm/writer');
const { readBarcodesFromImage } = require('../services/smartphoneBarcodeReader.cjs');
const { classifyBarcodeItems } = require('../services/smartphoneBarcodeCrossCheck.cjs');

async function barcodePng(text, format) {
  const result = await writeBarcode(text, { format, scale: 2, withHRT: false });
  assert.ok(result.image, `falhou ao gerar ${format}`);
  return Buffer.from(await result.image.arrayBuffer());
}

test('leitor encontra IMEIs e EAN numa etiqueta reduzida', { timeout: 60000 }, async () => {
  const imei1 = '865643073183577';
  const imei2 = '865643073183569';
  const ean = '6941764465282';
  const parts = await Promise.all([barcodePng(imei1, 'Code128'), barcodePng(imei2, 'Code128'), barcodePng(ean, 'EAN-13')]);
  const metas = await Promise.all(parts.map((part) => sharp(part).metadata()));
  const width = Math.max(...metas.map((meta) => meta.width)) + 200;
  let top = 120;
  const composites = parts.map((part, index) => {
    const item = { input: part, left: 100, top };
    top += metas[index].height + 140;
    return item;
  });
  const label = await sharp({ create: { width, height: top + 120, channels: 3, background: '#ffffff' } })
    .composite(composites).jpeg({ quality: 88 }).toBuffer();
  // "Foto" da caixa: etiqueta pequena no meio de um fundo amarelo grande.
  const labelSmall = await sharp(label).resize({ width: 900 }).toBuffer();
  const photo = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: '#e8b400' } })
    .composite([{ input: labelSmall, left: 700, top: 1400 }]).jpeg({ quality: 85 }).toBuffer();

  const result = await readBarcodesFromImage(photo);
  const classified = classifyBarcodeItems(result.items);
  assert.deepEqual(classified.imeis, [imei1, imei2], 'IMEIs na ordem da etiqueta');
  assert.deepEqual(classified.eans, [ean]);
});

test('imagem sem códigos não quebra', { timeout: 60000 }, async () => {
  const blank = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const result = await readBarcodesFromImage(blank);
  assert.deepEqual(result.items, []);
});
