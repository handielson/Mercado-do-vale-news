const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { PDFDocument } = require('pdf-lib');
const { buildMercadoLivreSummaryData, createMercadoLivreSummaryPdf,
    ML_SUMMARY_WIDTH_MM, ML_SUMMARY_HEIGHT_MM } = require('./mercado-livre-print-core.cjs');
const execFileAsync = promisify(execFile);

const STEPS = [
    { name: 'label', field: 'labelPrintedAt', suffix: 'etiqueta-10x15' },
    { name: 'declaration', field: 'declarationPrintedAt', suffix: 'declaracao-dce' },
    { name: 'summary', field: 'summaryPrintedAt', suffix: 'resumo-separacao-90x100' },
];

function writeJournal(file, record) {
    const temp = `${file}.tmp`;
    const fd = fs.openSync(temp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
}

function createMercadoLivreRequest({ apiUrl, syncKey, requestFetch = global.fetch }) {
    const base = new URL(apiUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
        throw new Error('Origem HTTPS da API Mercado Livre invalida.');
    }
    return async (route, { body, pdf = false } = {}) => {
        const response = await requestFetch(`${base.origin}/api/mercado-livre${route}`, {
            method: body ? 'POST' : 'GET', redirect: 'error',
            headers: { 'x-sync-key': syncKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
        });
        if (response.status === 204) return null;
        if (!response.ok) {
            // Do not put upstream bodies (which may contain private data) in printer logs.
            const error = new Error(`Mercado Livre ${route}: HTTP ${response.status}`);
            error.status = response.status;
            error.retryable = [409, 429, 500, 502, 503, 504].includes(response.status);
            throw error;
        }
        return pdf ? Buffer.from(await response.arrayBuffer()) : response.json();
    };
}

async function prepareMercadoLivreSummaryPrinter(printer) {
    const helper = [
        path.join(__dirname, 'central-print-runtime', 'central-print-paper.exe'),
        path.resolve(__dirname, '..', '..', 'scripts', 'central-print-runtime', 'central-print-paper.exe'),
    ].find(candidate => fs.existsSync(candidate));
    if (!fs.existsSync(helper)) throw new Error('Auxiliar de papel nao instalado para o comprovante Mercado Livre.');
    const { stdout } = await execFileAsync(helper, [printer, String(ML_SUMMARY_WIDTH_MM), String(ML_SUMMARY_HEIGHT_MM)],
        { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    const prepared = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    if (!prepared?.printer?.startsWith('MDV Central ') || Math.abs(prepared.widthMm - ML_SUMMARY_WIDTH_MM) > 0.1
        || Math.abs(prepared.heightMm - ML_SUMMARY_HEIGHT_MM) > 0.1) {
        throw new Error('Papel 90x100 mm nao confirmado para o comprovante Mercado Livre.');
    }
    return { printer: prepared.printer, orientation: 'portrait', scale: 'noscale' };
}

async function executeMercadoLivreJob({ job, settings, request, print, directory, journalDirectory,
    getStockLocations, prepareSummaryPrinter = prepareMercadoLivreSummaryPrinter, logger = console }) {
    const shipmentId = String(job.shipmentId || '');
    if (!/^(?:\d+|TESTE-[A-Z0-9-]+)$/.test(shipmentId)) throw new Error('Remessa invalida.');
    const labelPrinter = String(settings.shopee_printer_thermal || '').trim();
    const summaryPrinter = String(settings.shopee_printer_a4 || '').trim();
    if (!labelPrinter || !summaryPrinter) throw new Error('Configure as impressoras de etiqueta e comprovante na Shopee.');
    fs.mkdirSync(directory, { recursive: true });
    fs.mkdirSync(journalDirectory, { recursive: true });
    const prefix = `/print-jobs/${encodeURIComponent(shipmentId)}`;
    try {
        for (const step of STEPS) {
            if (job[step.field]) continue;
            const journalFile = path.join(journalDirectory, `${shipmentId}.${step.name}.json`);
            let record = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, 'utf8')) : null;
            if (record && record.status !== 'submitted') {
                const error = new Error(`Conferir impressao: ${step.name} da remessa ${shipmentId} tem tentativa sem confirmacao no Lenovo.`);
                error.retryable = false;
                throw error;
            }
            if (!record) {
                let buffer;
                if (step.name === 'summary') {
                    const summary = buildMercadoLivreSummaryData(job);
                    if (getStockLocations) {
                        try {
                            const locations = await getStockLocations(summary.items.map(item => item.sku).filter(Boolean));
                            summary.items = summary.items.map(item => ({ ...item,
                                stockLocation: locations[String(item.sku).toUpperCase()] || item.stockLocation }));
                        } catch { logger.warn('Mercado Livre: localizacao de estoque indisponivel.'); }
                    }
                    buffer = await createMercadoLivreSummaryPdf(summary);
                } else {
                    buffer = await request(`${prefix}/${step.name}`, { pdf: true });
                }
                const pdf = await PDFDocument.load(buffer);
                if (!pdf.getPageCount()) throw new Error('Documento PDF vazio.');
                const pdfFile = path.join(directory, `ML-${shipmentId}_${step.suffix}.pdf`);
                fs.writeFileSync(pdfFile, buffer, { mode: 0o600 });
                record = { shipmentId, step: step.name, status: 'sending', startedAt: new Date().toISOString() };
                // Persist BEFORE calling Windows. A crash here must require inspection, never another copy.
                writeJournal(journalFile, record);
                try {
                    await print(pdfFile, step.name === 'summary'
                        ? await prepareSummaryPrinter(summaryPrinter)
                        : { printer: labelPrinter, paperSize: '4x6', scale: 'fit' });
                } catch {
                    const error = new Error(`Conferir impressao: falha ao enviar ${step.name} da remessa ${shipmentId} ao Windows.`);
                    error.retryable = false;
                    throw error;
                }
                writeJournal(journalFile, { ...record, status: 'submitted', submittedAt: new Date().toISOString() });
            }
            // Retry only the acknowledgement when Windows already accepted the document.
            await request(`${prefix}/step`, { body: { step: step.name } });
            logger.log(`Mercado Livre: ${shipmentId} ${step.name} confirmado.`);
        }
        await request(`${prefix}/complete`, { body: { ok: true } });
        return { ok: true };
    } catch (error) {
        const retryable = error.retryable ?? (error instanceof TypeError || error.name === 'TimeoutError' || error.name === 'AbortError');
        await request(`${prefix}/complete`, { body: { ok: false, retryable, error: String(error.message).slice(0, 1000) } }).catch(() => {});
        throw error;
    }
}

function startMercadoLivrePrintAgent({ apiUrl, syncKey, getSettings, getStockLocations,
    directory = path.join(__dirname, 'Etiquetas de envio'), journalDirectory = path.join(__dirname, 'mercado_livre_printed'),
    request = createMercadoLivreRequest({ apiUrl, syncKey }),
    print = (...args) => require('pdf-to-printer').print(...args), logger = console, intervalMs = 60000 } = {}) {
    if (!syncKey) throw new Error('Chave da API ausente para impressao Mercado Livre.');
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const settings = await getSettings();
            if (!settings.shopee_printer_thermal || !settings.shopee_printer_a4) {
                throw new Error('Configure as impressoras de etiqueta e comprovante na Shopee.');
            }
            const job = await request('/print-jobs/next');
            if (job) await executeMercadoLivreJob({ job, settings, request, print, directory, journalDirectory, getStockLocations, logger });
        } catch (error) { logger.error('Mercado Livre Auto Print:', error.message); }
        finally { running = false; }
    };
    logger.log('Mercado Livre Auto Print: consumidor ativo; consulta a cada 60 segundos.');
    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return { tick, stop: () => clearInterval(timer) };
}

module.exports = { createMercadoLivreRequest, executeMercadoLivreJob, startMercadoLivrePrintAgent,
    prepareMercadoLivreSummaryPrinter };
