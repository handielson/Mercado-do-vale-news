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
            stockLocation: `Deposito / Prateleira ${index + 1}`,
        })),
    });
    assert.ok(Buffer.isBuffer(buffer) && buffer.length > 1_000, 'deve gerar um PDF com código de barras');
    const pdf = await PDFDocument.load(buffer);
    assert.equal(pdf.getPageCount(), 2, 'pedidos com muitos itens devem continuar em outra folha de comprovante 80 mm');
    const firstPageSize = pdf.getPage(0).getSize();
    assert.ok(Math.abs(firstPageSize.width - (80 * 72 / 25.4)) < 0.01, 'o comprovante deve ter largura real de 80 mm');
    assert.ok(Math.abs(firstPageSize.height - (152.4 * 72 / 25.4)) < 0.01, 'o comprovante deve manter altura de 152,4 mm');
    assert.equal(printableText('Código — “teste” ✅'), 'Código - "teste"', 'texto deve ficar compatível com fonte PDF');
    assert.match(formatOrderDate(1785325500), /\d{2}\/\d{2}\/\d{4}/, 'data deve ser exibida em pt-BR');

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    assert.ok(wrapText('um nome de produto muito comprido para uma linha', font, 8, 80, 2).length <= 2);
    assert.equal(wrapText('cliente com nome longo para apenas uma linha', font, 8, 80, 1).length, 1, 'campos de uma linha devem respeitar o limite');
    const fullName = 'Adaptador USB-C para P2 Audio 3.5mm com nome completo sem corte no comprovante';
    const wrappedName = wrapText(fullName, font, 8, 80, Number.POSITIVE_INFINITY);
    assert.equal(wrappedName.join(' '), fullName, 'nome do produto deve quebrar sem perder palavras ou adicionar reticencias');
    const longTokenLines = wrapText('PRODUTO-COM-IDENTIFICADOR-MUITO-LONGO-SEM-ESPACOS', font, 8, 80, Number.POSITIVE_INFINITY);
    assert.ok(longTokenLines.every((line) => font.widthOfTextAtSize(line, 8) <= 80), 'identificadores longos tambem devem quebrar dentro da largura');
    console.log('Shopee separation summary PDF checks passed.');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
