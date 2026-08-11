const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { createShopeeInterventionReceiptPdf } = require('../scripts/shopee-separation-summary.cjs');

(async () => {
    const buffer = await createShopeeInterventionReceiptPdf({
        order: {
            orderSn: 'TESTE-INTERVENCAO-001',
            buyerName: 'Cliente de Teste',
            paymentMethod: 'Cartao de credito',
            totalAmount: 189.9,
            items: [
                {
                    name: 'Cabo coaxial para antena de TV 100 metros',
                    sku: 'CCRG6100',
                    quantity: 2,
                    stockLocation: 'Loja Principal / Estoque Geral',
                },
                {
                    name: 'Conector para cabo coaxial',
                    sku: 'CON-RG6',
                    quantity: 4,
                    stockLocation: 'Deposito / Prateleira B2',
                },
            ],
        },
        stage: 'invoice',
        stageLabel: 'Nota fiscal',
        errorCode: 'bling_invoice_fiscal_error',
        message: 'O NCM informado no produto nao e aceito para esta operacao. Corrija a classificacao fiscal.',
        instructions: 'Abra a NF-e no Bling, corrija NCM, CEST ou tributacao, autorize a nota e confirme o envio para a Shopee.',
        occurredAt: Date.now(),
    });
    assert.ok(Buffer.isBuffer(buffer) && buffer.length > 1_000, 'deve gerar comprovante 80 mm não vazio');
    const pdf = await PDFDocument.load(buffer);
    assert.equal(pdf.getPageCount(), 1, 'dois itens devem caber em uma folha de comprovante 80 mm');
    const pageSize = pdf.getPage(0).getSize();
    assert.ok(Math.abs(pageSize.width - (80 * 72 / 25.4)) < 0.01, 'comprovante de intervencao deve ter largura real de 80 mm');
    assert.ok(Math.abs(pageSize.height - (152.4 * 72 / 25.4)) < 0.01, 'comprovante de intervencao deve manter altura de 152,4 mm');

    const outputPath = process.env.SHOPEE_INTERVENTION_SAMPLE_PATH;
    if (outputPath) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buffer);
    }
    console.log('Shopee intervention receipt PDF checks passed.');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
