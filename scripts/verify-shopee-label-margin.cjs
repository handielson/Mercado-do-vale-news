'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const { createRequire } = require('node:module');

const serviceRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const serviceRequire = createRequire(path.join(serviceRoot, 'package.json'));
const { PDFDocument, rgb } = serviceRequire('pdf-lib');
const core = require(path.join(serviceRoot, 'scripts', 'shopee-label-core.cjs'));
const PT_TO_MM = 25.4 / 72;

(async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 420.945, width: 297.64, height: 420.945, color: rgb(0, 0, 0) });
    const result = await core.expandShopeeLabelForThermalPaper(Buffer.from(await source.save()));
    const output = await PDFDocument.load(result);
    assert.equal(output.getPageCount(), 1);
    assert.ok(Math.abs(output.getPage(0).getWidth() * PT_TO_MM - 101.6) <= 0.02);
    assert.ok(Math.abs(output.getPage(0).getHeight() * PT_TO_MM - 152.4) <= 0.02);
    const placement = core.calculateShopeeThermalPlacement(595.28, 841.89);
    assert.ok(Math.abs((placement.pageWidth - placement.x - placement.width) * PT_TO_MM - 5) <= 0.02);
    console.log('VALIDACAO CONCLUIDA: etiqueta Shopee 4x6 com margem direita de 5 mm.');
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
