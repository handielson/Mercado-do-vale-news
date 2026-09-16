// Offline acceptance fixture: never calls Mercado Livre, the VPS, or fiscal endpoints.
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { executeMercadoLivreJob } = require('./mercado-livre-print-agent.cjs');

async function createTestPage(title) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([288, 432]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x: 12, y: 12, width: 264, height: 408, borderWidth: 1, color: rgb(1, 1, 1) });
    const lines = [
        ['TESTE DE IMPRESSAO', 16, bold], ['MERCADO LIVRE', 14, bold],
        [title, 13, bold], ['SEM VALOR FISCAL OU LOGISTICO', 10, bold],
        ['NAO POSTAR / NAO ENVIAR', 12, bold],
        ['Destino: Zebra ZD220', 11, font], ['Papel: 4 x 6 polegadas', 11, font],
        ['Dados ficticios - nenhuma venda real', 11, font],
        ['Conferir: nitidez, margens e orientacao.', 11, font],
    ];
    let y = 386;
    for (const [text, size, face] of lines) { page.drawText(text, { x: 23, y, size, font: face }); y -= 34; }
    page.drawLine({ start: { x: 23, y: 54 }, end: { x: 165, y: 54 }, thickness: 2 });
    page.drawText('Linha de referencia: 50 mm', { x: 23, y: 37, size: 9, font });
    return Buffer.from(await pdf.save());
}

async function run({ directory, physical = false, summaryOnly = false,
    testId = summaryOnly ? 'TESTE-20260916-ML02' : 'TESTE-20260916-ML01' }) {
    if (!/^TESTE-[A-Z0-9-]+$/.test(testId)) throw new Error('Use somente ID de teste.');
    const documents = { label: await createTestPage('ETIQUETA DE TESTE'), declaration: await createTestPage('DECLARACAO DE TESTE') };
    const events = []; let physicalSubmissions = 0;
    const request = async (route, options = {}) => {
        if (!route.startsWith(`/print-jobs/${testId}/`)) throw new Error('Somente o trabalho ficticio e permitido.');
        if (options.pdf) {
            const name = route.split('/').at(-1);
            if (!documents[name]) throw new Error('Documento de teste desconhecido.');
            return documents[name];
        }
        events.push({ route, ...options.body });
        return { ok: true };
    };
    const print = async (file, options) => {
        if (physical) {
            await require('pdf-to-printer').print(file, options);
            physicalSubmissions++;
        }
    };
    await executeMercadoLivreJob({
        job: { shipmentId: testId, orderId: 'TESTE-SEM-VALOR',
            ...(summaryOnly ? { labelPrintedAt: 'TESTE', declarationPrintedAt: 'TESTE' } : {}), payload: { order: {
            date_created: '2026-09-16T10:00:00-03:00', total_amount: 0, buyer: { nickname: 'TESTE - NAO ENVIAR' },
            comment: 'SEM VALOR FISCAL - DADOS FICTICIOS',
            order_items: [{ quantity: 1, item: { title: 'TESTE DE IMPRESSAO - NAO SEPARAR', seller_sku: 'TESTE-ML' } }],
        } } },
        settings: { shopee_printer_thermal: 'ZDesigner ZD220-203dpi ZPL', shopee_printer_a4: 'Comprovante' },
        request, print, directory,
        ...(!physical ? { prepareSummaryPrinter: async printer => ({ printer, orientation: 'portrait', scale: 'noscale' }) } : {}),
        journalDirectory: path.join(directory, physical ? 'journal-physical' : 'journal-preview'),
    });
    const result = { testId, physical, summaryOnly, physicalSubmissions, events, completedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(directory, `result-${Date.now()}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const target = args.indexOf('--output');
    const directory = path.resolve(target >= 0 ? args[target + 1] : path.join(__dirname, '../output/pdf/mercado-livre-test'));
    run({ directory, physical: args.includes('--print-test'), summaryOnly: args.includes('--summary-only') })
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { createTestPage, run };
