const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { executeMercadoLivreJob } = require('../scripts/mercado-livre-print-agent.cjs');
const { createMercadoLivreSummaryPdf, ML_SUMMARY_WIDTH_MM, ML_SUMMARY_HEIGHT_MM,
    ML_SUMMARY_HORIZONTAL_MARGIN_MM } = require('../scripts/mercado-livre-print-core.cjs');
const { presentPrintJob, classifyShipment, registerMercadoLivreRoutes } = require('../services/mercadoLivreServer.cjs');

async function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-ml-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const doc = await PDFDocument.create(); doc.addPage([288, 432]);
    const pdf = Buffer.from(await doc.save());
    const calls = [], printed = [], marked = [];
    const settings = { shopee_printer_thermal: 'ZD', shopee_printer_a4: 'Comprovante' };
    const job = { shipmentId: 'TESTE-UNIT-1', orderId: 'TESTE-SEM-VALOR', payload: { order: {
        order_items: [{ quantity: 1, item: { title: 'TESTE - NAO ENVIAR', seller_sku: 'TESTE' } }],
    } } };
    const request = async (route, options = {}) => {
        calls.push({ route, ...options });
        if (options.pdf) return pdf;
        if (route.endsWith('/step')) marked.push(options.body.step);
        return { ok: true };
    };
    const options = { job, settings, request, print: async (file, config) => printed.push({ file, config }),
        prepareSummaryPrinter: async printer => ({ printer, orientation: 'portrait', scale: 'noscale' }),
        directory: path.join(root, 'pdf'), journalDirectory: path.join(root, 'journal'), logger: { log() {}, warn() {} } };
    return { options, calls, printed, marked, pdf };
}

test('tres documentos usam destinos corretos e segunda execucao nao reimprime', async t => {
    const f = await fixture(t);
    await executeMercadoLivreJob(f.options);
    assert.deepEqual(f.printed.map(p => p.config.printer), ['ZD', 'ZD', 'Comprovante']);
    assert.deepEqual(f.marked, ['label', 'declaration', 'summary']);
    assert.equal(f.printed[0].config.paperSize, '4x6');
    assert.deepEqual(f.printed[2].config, { printer: 'Comprovante', orientation: 'portrait', scale: 'noscale' });
    assert.equal(f.calls.at(-1).body.ok, true);
    await executeMercadoLivreJob(f.options);
    assert.equal(f.printed.length, 3, 'restart with stale server state must only replay acknowledgements');
});

test('comprovante Mercado Livre usa pagina compacta 90x100 para a LABEL-9X10', async () => {
    const buffer = await createMercadoLivreSummaryPdf({
        orderId: 'TESTE-90X100', trackingNumber: 'BR123456789',
        payload: { order: { buyer: { nickname: 'TESTE' }, order_items: [{ quantity: 1, item: { title: 'Produto teste', seller_sku: 'SKU-1' } }] } },
    });
    const pdf = await PDFDocument.load(buffer);
    const page = pdf.getPage(0).getSize();
    assert.ok(Math.abs(page.width - (ML_SUMMARY_WIDTH_MM * 72 / 25.4)) < 0.01);
    assert.ok(Math.abs(page.height - (ML_SUMMARY_HEIGHT_MM * 72 / 25.4)) < 0.01);
    assert.equal(ML_SUMMARY_HORIZONTAL_MARGIN_MM, 10, 'conteudo deve recuar 10 mm de cada lateral');
});

test('DC-e em processamento retoma sem repetir etiqueta', async t => {
    const f = await fixture(t); let pending = true;
    const request = f.options.request;
    f.options.request = async (route, options) => {
        if (pending && route.endsWith('/declaration')) throw Object.assign(new Error('DC-e pendente'), { status: 409, retryable: true });
        return request(route, options);
    };
    await assert.rejects(executeMercadoLivreJob(f.options), /pendente/);
    assert.equal(f.printed.length, 1);
    assert.equal(f.calls.at(-1).body.retryable, true);
    pending = false;
    await executeMercadoLivreJob(f.options);
    assert.equal(f.printed.length, 3);
});

test('perda da confirmacao apos Windows retoma so a confirmacao', async t => {
    const f = await fixture(t); let fail = true;
    const request = f.options.request;
    f.options.request = async (route, options) => {
        if (fail && route.endsWith('/step')) throw new TypeError('fetch failed');
        return request(route, options);
    };
    await assert.rejects(executeMercadoLivreJob(f.options), /fetch failed/);
    assert.equal(f.printed.length, 1);
    assert.equal(f.calls.at(-1).body.retryable, true);
    fail = false;
    await executeMercadoLivreJob(f.options);
    assert.equal(f.printed.length, 3);
});

test('falha ou queda durante envio exige conferencia e nunca repete automaticamente', async t => {
    const f = await fixture(t); let attempts = 0;
    f.options.print = async () => { attempts++; throw new Error('Windows lost connection'); };
    await assert.rejects(executeMercadoLivreJob(f.options), /Conferir impressao/);
    assert.equal(f.calls.at(-1).body.retryable, false);
    await assert.rejects(executeMercadoLivreJob(f.options), /tentativa sem confirmacao/);
    assert.equal(attempts, 1);
});

test('etapas ja confirmadas no servidor nao sao enviadas ao Windows', async t => {
    const f = await fixture(t);
    Object.assign(f.options.job, { labelPrintedAt: 'now', declarationPrintedAt: 'now', summaryPrintedAt: 'now' });
    await executeMercadoLivreJob(f.options);
    assert.equal(f.printed.length, 0);
    assert.equal(f.calls.length, 1);
});

test('documento invalido falha antes de registrar tentativa fisica', async t => {
    const f = await fixture(t);
    f.options.request = async (route, options) => options?.pdf ? Buffer.from('not a PDF') : {};
    await assert.rejects(executeMercadoLivreJob(f.options));
    assert.equal(f.printed.length, 0);
    assert.deepEqual(fs.readdirSync(f.options.journalDirectory), []);
});

test('remessas encerradas nao aparecem como erro nem como prontas para imprimir', () => {
    for (const status of ['shipped', 'delivered', 'cancelled', 'not_delivered']) {
        const job = { shipment_status: status, status: 'intervention', last_error: 'old' };
        assert.equal(classifyShipment({ status }).printable, false);
        assert.equal(presentPrintJob(job).status, 'closed');
        assert.equal(presentPrintJob(job).last_error, null);
        assert.equal(job.status, 'intervention', 'read-only projection must preserve audit');
    }
    assert.equal(presentPrintJob({ shipment_status: 'delivered', status: 'printed' }).status, 'printed');
});

test('fila reconcilia DC-e pronta, reserva atomicamente e consulta a remessa atual', async t => {
    const handlers = {}; const queries = []; let claimed = false;
    const app = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (route, opts, handler) => { handlers[route] = handler; }]));
    const pool = { query: async (sql, args) => {
        queries.push(sql);
        if (sql.startsWith('SELECT shipment_id')) return [[{ shipment_id: '123' }]];
        if (sql.startsWith('SELECT * FROM mercado_livre_settings')) return [[{ access_token: 'test', token_expires_at: '2099-01-01' }]];
        if (sql.startsWith('SELECT * FROM mercado_livre_print_jobs')) return [[{ shipment_id: '123', order_id: '456' }]];
        if (sql.includes('attempts=attempts+1')) { if (claimed) return [{ affectedRows: 0 }]; claimed = true; }
        return [{ affectedRows: 1 }];
    } };
    const oldFetch = global.fetch;
    t.after(() => { global.fetch = oldFetch; });
    global.fetch = async () => new Response(JSON.stringify({ id: '123', status: 'ready_to_ship', substatus: 'ready_to_print' }));
    registerMercadoLivreRoutes(app, { pool, requireSyncKey() {} });
    const reply = { code(n) { this.status = n; return this; }, send() { return null; } };
    const first = await handlers['/mercado-livre/print-jobs/next']({}, reply);
    assert.equal(first.shipmentId, '123');
    assert.ok(queries.some(sql => sql.includes("AND status='awaiting_dce'")));
    assert.ok(queries.find(sql => sql.includes('attempts=attempts+1')).includes("AND shipment_status='ready_to_ship'"));
    await handlers['/mercado-livre/print-jobs/next']({}, reply);
    assert.equal(reply.status, 204, 'another consumer cannot take the same claim');
    claimed = false;
    global.fetch = async () => new Response(JSON.stringify({ id: '123', status: 'cancelled' }));
    await handlers['/mercado-livre/print-jobs/next']({}, reply);
    assert.equal(reply.status, 204, 'live cancellation blocks a stale ready job');
});

test('webhook simulado emite DC-e e prepara fila sem venda real nem emissao externa', async t => {
    const handlers = {}; const states = []; let emitted = 0;
    let finish; const processed = new Promise(resolve => { finish = resolve; });
    const app = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (route, opts, handler) => { handlers[route] = handler; }]));
    app.log = { error(error) { finish(error); } };
    const pool = { query: async (sql, args) => {
        if (sql.startsWith('SELECT * FROM mercado_livre_settings')) return [[{ access_token: 'test', token_expires_at: '2099-01-01', auto_dce_enabled: 1 }]];
        if (sql.includes('INSERT INTO mercado_livre_print_jobs')) states.push(args[3]);
        if (sql.includes("SET status='processed'")) finish();
        return [{ affectedRows: 1 }];
    } };
    const oldFetch = global.fetch; t.after(() => { global.fetch = oldFetch; });
    global.fetch = async (url, options) => {
        let value;
        if (url.endsWith('/orders/456')) value = { id: 456, shipping: { id: 123 }, order_items: [] };
        else if (url.endsWith('/shipments/123')) value = { id: 123, status: 'ready_to_ship', substatus: emitted ? 'ready_to_print' : 'invoice_pending' };
        else if (url.endsWith('/dce/emission')) { assert.equal(options.method, 'POST'); emitted++; value = { ok: true }; }
        else throw new Error('Unexpected external route: ' + url);
        return new Response(JSON.stringify(value));
    };
    registerMercadoLivreRoutes(app, { pool, requireSyncKey() {} });
    const reply = { code() { return this; }, send() { return this; } };
    await handlers['/mercado-livre/webhook']({ body: { topic: 'orders_v2', resource: '/orders/456' } }, reply);
    assert.equal(await processed, undefined);
    assert.equal(emitted, 1);
    assert.deepEqual(states, ['awaiting_dce', 'ready']);
});

test('publicacao seletiva inclui somente o modulo Mercado Livre antes de reiniciar API', () => {
    const source = fs.readFileSync(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
    const section = source.split("if (process.argv.includes('--mercado-livre-only')) {")[1].split("if (process.argv.includes('--central-printing-only'))")[0];
    assert.ok(section.indexOf('node --check') < section.indexOf('pm2 restart'));
    assert.ok(section.includes('mercadoLivreServicePath'));
    assert.ok(section.includes('cp -p'));
    assert.ok(!section.includes('localServer'));
});
