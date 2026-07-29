const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const {
    createShopeeSeparationSummaryPdf,
    formatOrderDate,
    printableText,
    wrapText,
} = require('../scripts/shopee-separation-summary.cjs');

(async () => {
    const buffer = await createShopeeSeparationSummaryPdf({
        orderSn: '260729TESTE123',
        trackingNumber: 'BR123456789MDV',
        buyerName: 'Cliente Teste',
        shippingCarrier: 'Shopee Xpress',
        createdAt: 1785325500,
        note: 'Conferir modelo antes de embalar.',
        items: Array.from({ length: 5 }, (_, index) => ({
            name: `Produto de teste ${index + 1} com nome suficientemente longo`,
            modelName: `Cor ${index + 1}`,
            sku: `SKU-${index + 1}`,
            quantity: index + 1,
        })),
    });
    assert.ok(Buffer.isBuffer(buffer) && buffer.length > 1_000, 'deve gerar um PDF com código de barras');
    const pdf = await PDFDocument.load(buffer);
    assert.equal(pdf.getPageCount(), 2, 'pedidos com mais de quatro itens devem continuar em outra folha 10x15');
    assert.equal(printableText('Código — “teste” ✅'), 'Código - "teste"', 'texto deve ficar compatível com fonte PDF');
    assert.match(formatOrderDate(1785325500), /\d{2}\/\d{2}\/\d{4}/, 'data deve ser exibida em pt-BR');

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    assert.ok(wrapText('um nome de produto muito comprido para uma linha', font, 8, 80, 2).length <= 2);
    console.log('Shopee separation summary PDF checks passed.');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
