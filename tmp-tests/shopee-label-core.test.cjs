'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { PDFDocument, rgb } = require('pdf-lib');
const {
    SHOPEE_THERMAL_WIDTH_MM,
    SHOPEE_THERMAL_HEIGHT_MM,
    SHOPEE_LABEL_RIGHT_SAFE_MARGIN_MM,
    calculateShopeeThermalPlacement,
    expandShopeeLabelForThermalPaper,
} = require('../scripts/shopee-label-core.cjs');

const PT_TO_MM = 25.4 / 72;
const near = (actual, expected, tolerance = 0.02) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} deve ficar próximo de ${expected}`);
};

test('gera uma pagina fisica 4x6 e reserva 5 mm somente no lado direito', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 420.945, width: 297.64, height: 420.945, color: rgb(0, 0, 0) });

    const result = await expandShopeeLabelForThermalPaper(Buffer.from(await source.save()));
    const transformed = await PDFDocument.load(result);
    assert.equal(transformed.getPageCount(), 1);
    const size = transformed.getPage(0).getSize();
    near(size.width * PT_TO_MM, SHOPEE_THERMAL_WIDTH_MM);
    near(size.height * PT_TO_MM, SHOPEE_THERMAL_HEIGHT_MM);

    const placement = calculateShopeeThermalPlacement(595.28, 841.89);
    near(placement.x * PT_TO_MM, 0);
    near((placement.pageWidth - placement.x - placement.width) * PT_TO_MM, SHOPEE_LABEL_RIGHT_SAFE_MARGIN_MM);
    assert.ok(placement.y > 0, 'deve preservar a centralizacao vertical que o modo fit ja aplicava');
    assert.ok(placement.height < placement.pageHeight, 'o conteudo nao deve ser cortado verticalmente');
});

test('mantem todas as paginas com o mesmo recuo seguro', async () => {
    const source = await PDFDocument.create();
    for (let index = 0; index < 2; index += 1) {
        const page = source.addPage([595.28, 841.89]);
        page.drawRectangle({ x: 0, y: 420.945, width: 297.64, height: 420.945, color: rgb(index, 0, 0) });
    }
    const result = await expandShopeeLabelForThermalPaper(Buffer.from(await source.save()));
    const transformed = await PDFDocument.load(result);
    assert.equal(transformed.getPageCount(), 2);
    for (const page of transformed.getPages()) {
        near(page.getWidth() * PT_TO_MM, SHOPEE_THERMAL_WIDTH_MM);
        near(page.getHeight() * PT_TO_MM, SHOPEE_THERMAL_HEIGHT_MM);
        assert.equal(page.getRotation().angle, 0);
    }
});
