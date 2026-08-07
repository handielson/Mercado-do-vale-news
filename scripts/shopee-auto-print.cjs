const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const {
    createShopeeInterventionReceiptPdf,
    createShopeeSeparationSummaryPdf,
} = require('./shopee-separation-summary.cjs');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutos

// PDFs que podem ser consultados e apagados pelo painel. Os marcadores ficam
// separados: limpar etiquetas nunca faz pedidos antigos serem impressos de novo.
const shippingLabelsDir = path.join(__dirname, 'Etiquetas de envio');
const printedMarkersDir = path.join(__dirname, 'shopee_printed');

for (const directory of [shippingLabelsDir, printedMarkersDir]) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function getShippingLabelsSummary() {
    const files = fs.readdirSync(shippingLabelsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'));
    const totalBytes = files.reduce((total, entry) => total + fs.statSync(path.join(shippingLabelsDir, entry.name)).size, 0);
    return { folder: shippingLabelsDir, files: files.length, total_bytes: totalBytes };
}

function clearShippingLabels() {
    let deleted = 0;
    for (const entry of fs.readdirSync(shippingLabelsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.pdf')) continue;
        fs.unlinkSync(path.join(shippingLabelsDir, entry.name));
        deleted += 1;
    }
    return { ...getShippingLabelsSummary(), deleted };
}

// Para assinar requisições da Shopee Open API v2
function generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
    const baseStr = partnerId + apiPath + timestamp + accessToken + shopId;
    return crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
}

const VPS_API_URL = (process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const VPS_SYNC_KEY = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || '';
const execFileAsync = promisify(execFile);
const LOCAL_PANEL_ORIGINS = new Set([
    'https://www.mercadodovale.com.br',
    'https://mercadodovale.com.br',
    'http://localhost:5173',
]);

async function getFetch() {
    if (typeof fetch === 'function') return fetch;
    const mod = await import('node-fetch');
    return mod.default;
}

async function callVpsShopeeAction(action, payload = {}) {
    const requestFetch = await getFetch();
    const response = await requestFetch(`${VPS_API_URL}/api/shopee-actions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-sync-key': VPS_SYNC_KEY,
        },
        body: JSON.stringify({ action, payload }),
        signal: AbortSignal.timeout(60000),
    });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
        return {
            ok: response.ok,
            status: response.status,
            contentType,
            buffer: Buffer.from(await response.arrayBuffer()),
            data: null,
        };
    }
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { error: text || `HTTP ${response.status}` };
    }
    return { ok: response.ok, status: response.status, contentType, buffer: null, data };
}

function orderPrintStatePaths(orderSn) {
    return {
        legacy: path.join(printedMarkersDir, `${orderSn}.txt`),
        label: path.join(printedMarkersDir, `${orderSn}.label.txt`),
        summary: path.join(printedMarkersDir, `${orderSn}.summary.txt`),
    };
}

function markPrintStep(markerPath) {
    fs.writeFileSync(markerPath, new Date().toISOString());
}

function normalizeInterventionIssue(stage, resultOrError) {
    const data = resultOrError?.data || {};
    const errorCode = String(
        data.error
        || resultOrError?.code
        || (resultOrError?.status ? `http_${resultOrError.status}` : '')
        || 'erro_nao_identificado',
    ).trim();
    const message = String(
        data.message
        || resultOrError?.message
        || data.error
        || `Falha na etapa ${stage}.`,
    ).trim();
    return { stage, errorCode, message };
}

function requiresHumanIntervention(stage, resultOrError) {
    const issue = normalizeInterventionIssue(stage, resultOrError);
    const normalized = `${issue.errorCode} ${issue.message}`.toLowerCase();
    if (resultOrError?.data?.requires_human_intervention === true) return true;
    if (stage === 'shipping_document') return true;
    if (stage === 'label_print' || stage === 'summary') return true;
    if (stage === 'invoice') {
        if (resultOrError?.data?.pending === true || resultOrError?.status === 202) return false;
        return !/invoice_not_found|authorization_pending|ainda nao apareceu|ainda não apareceu|ainda nao retornou autorizada|ainda não retornou autorizada/.test(normalized);
    }
    if (stage === 'ship_order') {
        return !/invoice|nota fiscal|lack_of_invoice_data|pending|not_ready|not ready|precheck_failed/.test(normalized);
    }
    return true;
}

function interventionInstructions(stage) {
    return {
        invoice: 'Abra a NF-e no Bling, corrija NCM, CEST ou tributacao, autorize a nota e confirme o envio para a Shopee.',
        ship_order: 'Abra o pedido na Shopee e no Bling, resolva o bloqueio informado e prepare o envio manualmente se necessario.',
        shipping_document: 'Confira se o pedido esta preparado para envio e gere a etiqueta manualmente na Shopee antes de despachar.',
        label_print: 'Verifique a impressora de etiquetas, papel, conexao e fila do Windows. Depois imprima a etiqueta manualmente.',
        summary: 'Verifique a impressora de comprovante, papel, conexao e fila do Windows. Depois imprima o resumo manualmente.',
    }[stage] || 'Abra o pedido, corrija o problema informado e retome o fluxo antes de despachar.';
}

function isVpsActionSuccess(result) {
    return Boolean(result?.ok && !result?.data?.error && result?.data?.success !== false);
}

function buildShopeeGetUrl(settings, shopeeApiUrl, apiPath, extraParams = {}) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(
        settings.shopee_partner_id,
        settings.shopee_partner_key,
        apiPath,
        timestamp,
        settings.shopee_access_token,
        settings.shopee_shop_id,
    );
    const params = new URLSearchParams({
        partner_id: String(settings.shopee_partner_id),
        timestamp: String(timestamp),
        access_token: String(settings.shopee_access_token),
        shop_id: String(settings.shopee_shop_id),
        sign,
        ...extraParams,
    });
    return `${shopeeApiUrl}${apiPath}?${params.toString()}`;
}

async function getShopeeOrderSummaryData(settings, shopeeApiUrl, orderSn) {
    const requestFetch = await getFetch();
    const detailUrl = buildShopeeGetUrl(settings, shopeeApiUrl, '/api/v2/order/get_order_detail', {
        order_sn_list: orderSn,
        response_optional_fields: [
            'buyer_username',
            'recipient_address',
            'item_list',
            'shipping_carrier',
            'checkout_shipping_carrier',
            'note',
            'create_time',
            'package_list',
            'payment_method',
            'total_amount',
        ].join(','),
    });
    const detailResponse = await requestFetch(detailUrl);
    const detailData = await detailResponse.json();
    if (!detailResponse.ok || detailData?.error) {
        throw new Error(detailData?.message || detailData?.error || `Falha ao consultar o pedido ${orderSn}.`);
    }
    const order = detailData?.response?.order_list?.[0];
    if (!order) throw new Error(`Pedido ${orderSn} não retornou detalhes para o resumo.`);

    const packageInfo = Array.isArray(order.package_list) ? order.package_list[0] || {} : {};
    const packageNumber = String(packageInfo.package_number || '').trim();
    let trackingNumber = String(
        packageInfo.tracking_number
        || packageInfo.logistics_tracking_number
        || order.tracking_number
        || '',
    ).trim();
    try {
        const trackingUrl = buildShopeeGetUrl(settings, shopeeApiUrl, '/api/v2/logistics/get_tracking_number', {
            order_sn: orderSn,
            ...(packageNumber ? { package_number: packageNumber } : {}),
        });
        const trackingResponse = await requestFetch(trackingUrl);
        const trackingData = await trackingResponse.json();
        if (trackingResponse.ok && !trackingData?.error) {
            trackingNumber = String(
                trackingData?.response?.tracking_number
                || trackingData?.response?.first_mile_tracking_number
                || trackingData?.response?.logistics_tracking_no
                || trackingNumber,
            ).trim();
        }
    } catch (trackingError) {
        console.warn(`[SUMMARY] Rastreio ainda indisponível para ${orderSn}: ${trackingError.message}`);
    }

    const items = (Array.isArray(order.item_list) ? order.item_list : []).map((item) => ({
        name: item?.item_name || item?.product_name || 'Item Shopee',
        modelName: item?.model_name || '',
        sku: item?.model_sku || item?.item_sku || item?.seller_sku || '',
        quantity: item?.model_quantity_purchased || item?.quantity || 1,
    }));
    const itemSkus = Array.from(new Set(items.map((item) => String(item.sku || '').trim()).filter(Boolean)));
    const stockLocationsBySku = new Map();
    if (itemSkus.length) {
        try {
            const locationResult = await callVpsShopeeAction('get_stock_locations', { skus: itemSkus });
            if (isVpsActionSuccess(locationResult)) {
                for (const entry of locationResult.data?.items || []) {
                    stockLocationsBySku.set(
                        String(entry?.sku || '').trim().toUpperCase(),
                        Array.isArray(entry?.locations) ? entry.locations.filter(Boolean) : [],
                    );
                }
            } else {
                console.warn(`[SUMMARY] Localização indisponível para ${orderSn}: ${locationResult.data?.message || locationResult.data?.error || `HTTP ${locationResult.status}`}`);
            }
        } catch (locationError) {
            console.warn(`[SUMMARY] Falha ao consultar localização para ${orderSn}: ${locationError.message}`);
        }
    }

    return {
        orderSn,
        trackingNumber,
        buyerName: order?.recipient_address?.name || order?.buyer_username || 'Cliente Shopee',
        shippingCarrier: order?.shipping_carrier || order?.checkout_shipping_carrier || 'Shopee',
        createdAt: order?.create_time,
        note: order?.note || '',
        paymentMethod: order?.payment_method || '',
        totalAmount: Number(order?.total_amount || 0),
        items: items.map((item) => {
            const locations = stockLocationsBySku.get(String(item.sku || '').trim().toUpperCase()) || [];
            return {
                ...item,
                stockLocation: locations.length ? locations.join(' | ') : 'Não cadastrada',
            };
        }),
    };
}

async function printHumanInterventionReceipt({ settings, shopeeApiUrl, orderSn, stage, resultOrError }) {
    const summaryPrinter = String(settings?.shopee_printer_a4 || '').trim();
    if (!summaryPrinter) {
        console.error(`[INTERVENTION] Impressora de comprovante não configurada para ${orderSn}.`);
        return { printed: false, reason: 'summary_printer_missing' };
    }

    const issue = normalizeInterventionIssue(stage, resultOrError);
    const issueHash = crypto.createHash('sha1')
        .update(`${stage}|${issue.errorCode}`)
        .digest('hex')
        .slice(0, 12);
    const markerPath = path.join(printedMarkersDir, `${orderSn}.intervention-${issueHash}.txt`);
    if (fs.existsSync(markerPath)) {
        console.log(`[INTERVENTION] Aviso ${issue.errorCode} já impresso para ${orderSn}.`);
        return { printed: false, reason: 'already_printed' };
    }

    let orderData = {
        orderSn,
        buyerName: 'Não foi possível consultar',
        paymentMethod: '',
        totalAmount: 0,
        items: [],
    };
    try {
        orderData = await getShopeeOrderSummaryData(settings, shopeeApiUrl, orderSn);
    } catch (summaryError) {
        console.warn(`[INTERVENTION] Dados parciais para ${orderSn}: ${summaryError.message}`);
    }

    try {
        const receiptPath = path.join(
            shippingLabelsDir,
            `${orderSn}_intervencao-${stage}-${issueHash}-10x15.pdf`,
        );
        const receipt = await createShopeeInterventionReceiptPdf({
            order: orderData,
            stage,
            stageLabel: {
                invoice: 'Nota fiscal',
                ship_order: 'Preparar envio',
                shipping_document: 'Gerar etiqueta',
                label_print: 'Imprimir etiqueta',
                summary: 'Imprimir resumo',
            }[stage] || stage,
            errorCode: issue.errorCode,
            message: issue.message,
            instructions: interventionInstructions(stage),
            occurredAt: Date.now(),
        });
        fs.writeFileSync(receiptPath, receipt);
        const ptp = require('pdf-to-printer');
        await ptp.print(receiptPath, {
            printer: summaryPrinter,
            paperSize: '80mm',
            scale: 'fit',
        });
        markPrintStep(markerPath);
        console.log(`[INTERVENTION] Comprovante ${issue.errorCode} impresso para ${orderSn}.`);
        return { printed: true, file: receiptPath };
    } catch (printError) {
        console.error(`[INTERVENTION] Falha ao imprimir aviso de ${orderSn}:`, printError.message || printError);
        return { printed: false, reason: 'print_failed', error: printError.message };
    }
}

// A etiqueta normal da Shopee ocupa um quadrante da página. O PDF ampliado é
// ajustado pelo driver ao papel térmico 10x15, preenchendo toda a folha.
async function expandShopeeLabelForThermalPaper(pdfBuffer) {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const outputPdf = await PDFDocument.create();

    for (const sourcePage of sourcePdf.getPages()) {
        const { width, height } = sourcePage.getSize();
        const label = await outputPdf.embedPage(sourcePage, {
            left: 0,
            bottom: height / 2,
            right: width / 2,
            top: height,
        });
        const outputPage = outputPdf.addPage([width, height]);
        outputPage.drawPage(label, { x: 0, y: 0, width, height });
    }

    return Buffer.from(await outputPdf.save());
}

async function createThermalTestPdf({ title, subtitle, lines }) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([288, 432]); // 4 x 6 polegadas (10 x 15 cm)
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x: 0, y: 0, width: 288, height: 432, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 18, y: 374, width: 252, height: 40, color: rgb(0.06, 0.12, 0.22) });
    page.drawText(title, { x: 30, y: 390, size: 15, font: bold, color: rgb(1, 1, 1) });
    page.drawText(subtitle, { x: 30, y: 354, size: 9, font: regular, color: rgb(0.25, 0.3, 0.36) });
    let y = 320;
    for (const line of lines) {
        page.drawText(line, { x: 30, y, size: 12, font: regular, color: rgb(0.08, 0.12, 0.18) });
        y -= 28;
    }
    page.drawRectangle({ x: 30, y: 62, width: 228, height: 2, color: rgb(0.08, 0.12, 0.18) });
    page.drawText('TESTE - nenhum pedido real foi alterado', {
        x: 30, y: 38, size: 9, font: bold, color: rgb(0.72, 0.12, 0.12),
    });
    return Buffer.from(await pdf.save());
}

async function runPrintFlowTest() {
    const settings = await getCompanySettings();
    const labelPrinter = String(settings.shopee_printer_thermal || '').trim();
    const summaryPrinter = String(settings.shopee_printer_a4 || '').trim();
    if (!labelPrinter || !summaryPrinter) {
        throw new Error('Selecione e salve as duas impressoras térmicas antes de executar o teste.');
    }

    const ptp = require('pdf-to-printer');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const labelPath = path.join(shippingLabelsDir, `TESTE_${stamp}_etiqueta-10x15.pdf`);
    const summaryPath = path.join(shippingLabelsDir, `TESTE_${stamp}_resumo-separacao-10x15.pdf`);
    fs.writeFileSync(labelPath, await createThermalTestPdf({
        title: 'ETIQUETA DE ENVIO',
        subtitle: 'Fluxo Shopee - teste local',
        lines: ['1. Nota fiscal: simulada', '2. Preparar envio: simulado', '3. Etiqueta 10x15: pronta', 'Impressora 1: OK'],
    }));
    fs.writeFileSync(summaryPath, await createThermalTestPdf({
        title: 'RESUMO DE SEPARAÇÃO',
        subtitle: 'Fluxo Shopee - teste local',
        lines: ['Pedido teste #TESTE', 'Produto: conferência de impressão', 'Quantidade: 1', 'Impressora 2: OK'],
    }));

    await ptp.print(labelPath, { printer: labelPrinter, paperSize: '4x6', scale: 'fit' });
    await ptp.print(summaryPath, { printer: summaryPrinter, paperSize: '80mm', scale: 'fit' });
    return { label_file: path.basename(labelPath), summary_file: path.basename(summaryPath) };
}

async function pullPrinterServiceUpdate() {
    const projectRoot = path.resolve(__dirname, '..');
    const { stdout: pullStdout, stderr: pullStderr } = await execFileAsync(
        'git',
        ['pull', '--ff-only', 'origin', 'main'],
        { cwd: projectRoot, windowsHide: true, timeout: 120000 },
    );
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const { stdout: installStdout, stderr: installStderr } = await execFileAsync(
        npmCommand,
        ['install', '--omit=dev', '--no-audit', '--no-fund'],
        { cwd: projectRoot, windowsHide: true, timeout: 180000 },
    );
    return [pullStdout, pullStderr, installStdout, installStderr]
        .filter(Boolean)
        .join('\n')
        .trim();
}

function normalizePrinterNames(printers) {
    return Array.from(new Set(
        printers
            .map(printer => String(printer?.name || printer?.deviceId || printer || '').trim())
            .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

async function getLocalPrinterNames() {
    try {
        const ptp = require('pdf-to-printer');
        return normalizePrinterNames(await ptp.getPrinters());
    } catch (pdfToPrinterError) {
        if (process.platform !== 'win32') throw pdfToPrinterError;

        // Algumas instalações retornam propriedades incompletas para pdf-to-printer.
        const { stdout } = await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-Command', 'Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name'],
            { windowsHide: true, timeout: 30000 },
        );
        return normalizePrinterNames(stdout.split(/\r?\n/));
    }
}

async function restartPrinterServiceAfterUpdate() {
    const pm2Command = process.platform === 'win32' ? 'pm2.cmd' : 'pm2';
    const projectRoot = path.resolve(__dirname, '..');
    await execFileAsync(pm2Command, ['restart', 'shopee-auto-print'], {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 60000,
    });
    await execFileAsync(pm2Command, ['save'], {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 60000,
    });
}

async function getCompanySettings() {
    console.log("-> Lendo configuracoes Shopee e impressoras da VPS...");
    if (!VPS_SYNC_KEY) {
        throw new Error('VITE_VPS_SYNC_KEY, VPS_SYNC_KEY ou SYNC_SECRET precisa estar configurado para ler /company-settings.');
    }
    let vpsData = {};
    try {
        const requestFetch = await getFetch();
        const res = await requestFetch(`${VPS_API_URL}/company-settings`, {
            headers: { 'x-sync-key': VPS_SYNC_KEY },
        });
        if (res.ok) {
            vpsData = await res.json();
        } else {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ''}`);
        }
    } catch (e) {
        console.error('Falha não-critica ao ler impressoras da VPS:', e.message);
    }

    // A fonte de verdade dos TOKENS da Shopee e do Partner Key é o banco legado original!
    const vpsSettings = vpsData;
    const error = !vpsSettings || typeof vpsSettings !== 'object' || !vpsSettings.shopee_partner_id
        ? new Error('Resposta vazia ou incompleta ao ler /company-settings na VPS.')
        : null;
    
    if (error) throw error;

    return {
        ...vpsSettings,
        shopee_printer_thermal: vpsData.shopee_printer_thermal || vpsSettings.shopee_printer_thermal,
        shopee_printer_a4: vpsData.shopee_printer_a4 || vpsSettings.shopee_printer_a4
    };
}

// Função para iniciar servidor web local para escolher a impressora
function startLocalServer() {
    const server = http.createServer(async (req, res) => {
        // CORS headers - needed because browser HTTPS calls localhost HTTP
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        if (req.url === '/test-flow' && req.method === 'POST') {
            runPrintFlowTest().then((result) => {
                console.log('[TEST FLOW] Etiqueta e resumo enviados para impressão:', result);
            }).catch((err) => {
                console.error('[TEST FLOW] Falhou:', err.message);
            });
            res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ ok: true, message: 'Fluxo de teste iniciado. Verifique as duas impressoras.' }));
        }

        if (req.url === '/update-service' && req.method === 'POST') {
            const origin = String(req.headers.origin || '').replace(/\/+$/, '');
            if (!LOCAL_PANEL_ORIGINS.has(origin)) {
                res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ error: 'Atualização permitida somente pelo painel Mercado do Vale.' }));
            }
            try {
                const output = await pullPrinterServiceUpdate();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, message: 'Atualização concluída. Reiniciando o serviço local...', output }));
                setTimeout(() => {
                    restartPrinterServiceAfterUpdate()
                        .then(() => console.log('[LOCAL UPDATE] Serviço de impressão reiniciado.'))
                        .catch((err) => console.error('[LOCAL UPDATE] Falha ao reiniciar o serviço:', err.message));
                }, 300);
            } catch (err) {
                console.error('[LOCAL UPDATE] Falha ao atualizar:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Não foi possível atualizar o serviço local: ${err.message}` }));
            }
            return;
        }

        if (req.url === '/shipping-labels') {
            try {
                const summary = req.method === 'DELETE'
                    ? clearShippingLabels()
                    : getShippingLabelsSummary();
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify(summary));
            } catch (err) {
                console.error('[LOCAL LABELS] Falha ao limpar etiquetas:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ error: 'Não foi possível administrar a pasta de etiquetas.' }));
            }
        }

        if (req.url === '/printers') {
            getLocalPrinterNames().then(names => {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ printers: names }));
            }).catch(err => {
                console.error('[LOCAL PRINTERS] Falha ao listar impressoras:', err.message);
                res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Não foi possível listar as impressoras do Windows.' }));
            });
        } else if (req.url === '/') {
            const ptp = require('pdf-to-printer');
            ptp.getPrinters().then(printers => {
                const list = printers.map(p => `<li>${p.deviceId || p.name || p}</li>`).join('');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(`
                    <html>
                        <head><title>Impressoras Shopee</title></head>
                        <body style="font-family: sans-serif; padding: 2rem;">
                            <h2>Servidor de Impressão Ativo.</h2>
                            <p><strong>Status:</strong> Pronto para receber solicitações da nuvem.</p>
                            <h3>Impressoras detectadas nesta máquina:</h3>
                            <ul>${list}</ul>
                        </body>
                    </html>
                `);
            }).catch(err => {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(`
                    <html>
                        <head><title>Impressoras Shopee</title></head>
                        <body style="font-family: sans-serif; padding: 2rem;">
                            <h2>Servidor de Impressão Ativo.</h2>
                            <p>A listagem automática foi desativada temporariamente por uma incompatibilidade do Windows com os drivers locais.</p>
                            <p><strong>Não se preocupe:</strong> Os comandos de impressão direta definidos no painel continuarão operando normalmente.</p>
                        </body>
                    </html>
                `);
            });
        } else if (req.url.startsWith('/print-order')) {
            const urlParams = new URLSearchParams(req.url.split('?')[1]);
            const orderSn = urlParams.get('order_sn');
            const docType = urlParams.get('type') || 'both'; // 'awb', 'summary', or 'both'
            
            if (!orderSn) {
                res.writeHead(400);
                return res.end('order_sn ausente');
            }
            
            // Execute as a detached background promise to not block HTTP response
            // We tell the UI it has started
            res.writeHead(200);
            res.end(`Comando de impressao enviado para o pedido ${orderSn}`);
            
            // Process print in background
            setTimeout(async () => {
                try {
                    console.log(`[MANUAL PRINT] Disparado para ${orderSn} (tipo: ${docType})`);
                    const ptp = require('pdf-to-printer');
                    const settings = await getCompanySettings();
                    const shopeeApiUrl = String(settings.shopee_partner_id).startsWith('10') ? 'https://partner.test-stable.shopeemobile.com' : 'https://partner.shopeemobile.com';
                    
                    const pathDoc = '/api/v2/logistics/download_shipping_document';
                    const tsDoc = Math.floor(Date.now() / 1000);
                    const signDoc = generateSign(settings.shopee_partner_id, settings.shopee_partner_key, pathDoc, tsDoc, settings.shopee_access_token, settings.shopee_shop_id);
                    const urlDoc = `${shopeeApiUrl}${pathDoc}?partner_id=${settings.shopee_partner_id}&timestamp=${tsDoc}&access_token=${settings.shopee_access_token}&shop_id=${settings.shopee_shop_id}&sign=${signDoc}`;

                    // CREATE THE DOCUMENT FIRST (MANDATORY FOR SHOPEE API V2 THERMAL PDFs)
                    const pathCreate = '/api/v2/logistics/create_shipping_document';
                    const signCreate = generateSign(settings.shopee_partner_id, settings.shopee_partner_key, pathCreate, tsDoc, settings.shopee_access_token, settings.shopee_shop_id);
                    const urlCreate = `${shopeeApiUrl}${pathCreate}?partner_id=${settings.shopee_partner_id}&timestamp=${tsDoc}&access_token=${settings.shopee_access_token}&shop_id=${settings.shopee_shop_id}&sign=${signCreate}`;
                    
                    if ((docType === 'both' || docType === 'awb') && settings.shopee_printer_thermal) {
                        try {
                            // Request generation of Thermal AWB
                            await fetch(urlCreate, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order_list: [{ order_sn: orderSn }], shipping_document_type: "NORMAL_AIR_WAYBILL" })
                            });
                            // Wait 2 seconds for Shopee to build the PDF internally
                            await new Promise(r => setTimeout(r, 2000));
                            
                            const rDoc = await fetch(urlDoc, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order_list: [{ order_sn: orderSn }], shipping_document_type: "NORMAL_AIR_WAYBILL" })
                            });
                            if (rDoc.headers.get('content-type')?.includes('pdf')) {
                                const pdfBuffer = await rDoc.arrayBuffer();
                                const tempPdfPath = path.join(shippingLabelsDir, `MANUAL_${orderSn}_etiqueta-10x15.pdf`);
                                fs.writeFileSync(tempPdfPath, await expandShopeeLabelForThermalPaper(Buffer.from(pdfBuffer)));
                                await ptp.print(tempPdfPath, {
                                    printer: settings.shopee_printer_thermal,
                                    paperSize: '4x6',
                                    scale: 'fit'
                                });
                                console.log(`[MANUAL PRINT] Etiqueta Térmica enviada!`);
                            } else {
                                const j = await rDoc.json();
                                console.log(`[MANUAL PRINT AWB REJECTED]:`, j);
                            }
                        } catch(e) { console.error("Erro manual AWB:", e); }
                    }
                    // We will send the summary to the thermal printer if A4 is not configured or if they want it on thermal.
                    // Wait, standard Shopee setup: A4 printer handles summary. Let's use A4 if it exists, otherwise fallback to thermal.
                    const targetSummaryPrinter = settings.shopee_printer_a4 || settings.shopee_printer_thermal;
                    
                    if ((docType === 'both' || docType === 'summary') && targetSummaryPrinter) {
                        try {
                            const summaryData = await getShopeeOrderSummaryData(settings, shopeeApiUrl, orderSn);
                            const tempPkgPath = path.join(shippingLabelsDir, `MANUAL_${orderSn}_resumo-separacao-10x15.pdf`);
                            fs.writeFileSync(tempPkgPath, await createShopeeSeparationSummaryPdf(summaryData));
                            await ptp.print(tempPkgPath, {
                                printer: targetSummaryPrinter,
                                paperSize: '80mm',
                                scale: 'fit'
                            });
                            console.log(`[MANUAL PRINT] Resumo com rastreio enviado!`);
                        } catch(e) { console.error("Erro manual Resumo:", e); }
                    }
                } catch(err) {
                    console.error("[MANUAL PRINT] Erro geral:", err);
                }
            }, 100);
        } else if (req.url.startsWith('/test-print')) {
            // Permitir requests do painel admin na web
            res.setHeader('Access-Control-Allow-Origin', '*');
            const urlParams = new URLSearchParams(req.url.split('?')[1]);
            const printerName = urlParams.get('printer');
            if (!printerName) {
                res.writeHead(400);
                return res.end('Nome da impressora ausente');
            }
            // Disparar a página de teste nativa do Windows
            const { exec } = require('child_process');
            exec(`RUNDLL32 PRINTUI.DLL,PrintUIEntry /k /n "${printerName}"`, (err) => {
                if (err) {
                    res.writeHead(500);
                    return res.end('Erro ao imprimir: ' + err.message);
                }
                res.writeHead(200);
                res.end('Página de teste enviada para ' + printerName);
            });
        }
    });
    server.listen(8081, '127.0.0.1', () => {
        console.log("Servidor local ativo! Escutando na porta 8081.");
    });
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function legacyRunLoop() {
    console.log(`[${new Date().toISOString()}] Iniciando ciclo do Shopee Auto Print...`);
    
    try {
        const settings = await getCompanySettings();
        const { shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token, shopee_printer_thermal } = settings;

        if (!shopee_access_token) {
            console.log("Shopee não conectada. Aguardando...");
            return;
        }

        if (!shopee_printer_thermal) {
            console.log("Nenhuma impressora térmica configurada. Pulando impressão...");
            return;
        }

        // Descobrir a API host correta (Sandbox começa com partner ID 10xxxxx -> test)
        const shopeeApiUrl = String(shopee_partner_id).startsWith('10') ? 'https://partner.test-stable.shopeemobile.com' : 'https://partner.shopeemobile.com';

        // 1. Buscar READY_TO_SHIP
        const pathList = '/api/v2/order/get_order_list';
        const tsList = Math.floor(Date.now() / 1000);
        const signList = generateSign(shopee_partner_id, shopee_partner_key, pathList, tsList, shopee_access_token, shopee_shop_id);

        const timeTo = tsList;
        const timeFrom = timeTo - (14 * 24 * 60 * 60);

        const urlList = `${shopeeApiUrl}${pathList}?partner_id=${shopee_partner_id}&timestamp=${tsList}&access_token=${shopee_access_token}&shop_id=${shopee_shop_id}&sign=${signList}&time_range_field=create_time&time_from=${timeFrom}&time_to=${timeTo}&page_size=30&order_status=READY_TO_SHIP`;

        const rList = await fetch(urlList);
        const dataList = await rList.json();

        if (dataList.error) {
            console.error("Shopee API Error:", dataList.message);
            return;
        }

        const orders = dataList.response?.order_list || [];
        if (orders.length === 0) {
            console.log("Nenhum pedido READY_TO_SHIP no momento.");
            return;
        }

        const ptp = require('pdf-to-printer');
        
        for (const order of orders) {
            const { order_sn } = order;
            // Check if already printed today / this run
            const markerFile = path.join(printedMarkersDir, `${order_sn}.txt`);
            if (fs.existsSync(markerFile)) {
                continue;
            }

            console.log(`Processando impressão de ${order_sn}...`);
            // 2. CREATE AND DOWNLOAD AWB
            const tsDoc = Math.floor(Date.now() / 1000);
            const pathDoc = '/api/v2/logistics/download_shipping_document';
            const signDoc = generateSign(shopee_partner_id, shopee_partner_key, pathDoc, tsDoc, shopee_access_token, shopee_shop_id);

            const pathCreate = '/api/v2/logistics/create_shipping_document';
            const signCreate = generateSign(shopee_partner_id, shopee_partner_key, pathCreate, tsDoc, shopee_access_token, shopee_shop_id);
            const urlCreate = `${shopeeApiUrl}${pathCreate}?partner_id=${shopee_partner_id}&timestamp=${tsDoc}&access_token=${shopee_access_token}&shop_id=${shopee_shop_id}&sign=${signCreate}`;

            const docPayload = {
                order_list: [{ order_sn }],
                shipping_document_type: "NORMAL_AIR_WAYBILL"
            };

            // Request generation
            await fetch(urlCreate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_list: [{ order_sn }], shipping_document_type: "NORMAL_AIR_WAYBILL", tracking_number: "" })
            });
            await delay(2000); // Wait for Shopee to build the PDF

            const urlDoc = `${shopeeApiUrl}${pathDoc}?partner_id=${shopee_partner_id}&timestamp=${tsDoc}&access_token=${shopee_access_token}&shop_id=${shopee_shop_id}&sign=${signDoc}`;
            
            const rDoc = await fetch(urlDoc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docPayload)
            });

            // Awb returns PDF stream, wait let me verify: Shopee download_shipping_document returns application/pdf byte stream
            if (rDoc.headers.get('content-type')?.includes('pdf')) {
                const pdfBuffer = await rDoc.arrayBuffer();
                const tempPdfPath = path.join(shippingLabelsDir, `${order_sn}_etiqueta-10x15.pdf`);
                fs.writeFileSync(tempPdfPath, await expandShopeeLabelForThermalPaper(Buffer.from(pdfBuffer)));
                
                console.log(`Enviando para impressora: ${shopee_printer_thermal}`);
                try {
                    await ptp.print(tempPdfPath, {
                        printer: shopee_printer_thermal,
                        paperSize: '4x6',
                        scale: 'fit'
                    });
                    console.log(`Sucesso ao imprimir ETIQUETA ${order_sn}!`);
                    
                    // --- IMPRIMIR RESUMO / PACKING LIST na A4 ---
                    if (settings.shopee_printer_a4) {
                        try {
                            console.log(`Gerando resumo de separação com rastreio para ${order_sn}...`);
                            const summaryData = await getShopeeOrderSummaryData(settings, shopeeApiUrl, order_sn);
                            const tempPkgPath = path.join(shippingLabelsDir, `${order_sn}_resumo-separacao-10x15.pdf`);
                            fs.writeFileSync(tempPkgPath, await createShopeeSeparationSummaryPdf(summaryData));
                            console.log(`Enviando Resumo para impressora: ${settings.shopee_printer_a4}`);
                            await ptp.print(tempPkgPath, {
                                printer: settings.shopee_printer_a4,
                                paperSize: '80mm',
                                scale: 'fit'
                            });
                            console.log(`Sucesso ao imprimir RESUMO ${order_sn}!`);
                        } catch (pkgErr) {
                            console.error(`Falha ao imprimir Resumo do pedido ${order_sn}:`, pkgErr);
                        }
                    }

                    // Marcar como totalmente impresso
                    fs.writeFileSync(markerFile, new Date().toISOString());
                } catch (e) {
                    console.error(`Falha na fila de impressão da etiqueta ${order_sn}: `, e);
                }
            } else {
                const jsonDoc = await rDoc.json();
                console.log(`Shopee document skip: ${jsonDoc.message || jsonDoc.error} (Pode não estar pronto na Shopee ainda)`);
            }
            
            await delay(3000); // 3 seconds between actions to respect API rate limits
        }
        
    } catch (e) {
        console.error("Erro Fatal no Ciclo:", e);
    }
}

let loopRunning = false;

async function runLoop() {
    if (loopRunning) {
        console.log('Ciclo anterior ainda está em execução; nova rodada ignorada.');
        return;
    }
    loopRunning = true;
    console.log(`[${new Date().toISOString()}] Iniciando ciclo seguro do Shopee Auto Print...`);

    try {
        const settings = await getCompanySettings();
        const {
            shopee_partner_id,
            shopee_partner_key,
            shopee_shop_id,
            shopee_access_token,
            shopee_printer_thermal,
        } = settings;
        if (!shopee_access_token) {
            console.log('Shopee não conectada. Aguardando...');
            return;
        }
        if (!shopee_printer_thermal) {
            console.log('Impressora térmica não configurada. Aguardando configuração no painel...');
            return;
        }

        const requestFetch = await getFetch();
        const shopeeApiUrl = String(shopee_partner_id).startsWith('10')
            ? 'https://partner.test-stable.shopeemobile.com'
            : 'https://partner.shopeemobile.com';
        const pathList = '/api/v2/order/get_order_list';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = generateSign(
            shopee_partner_id,
            shopee_partner_key,
            pathList,
            timestamp,
            shopee_access_token,
            shopee_shop_id,
        );
        const timeFrom = timestamp - (14 * 24 * 60 * 60);
        const listUrl = `${shopeeApiUrl}${pathList}?partner_id=${shopee_partner_id}&timestamp=${timestamp}&access_token=${shopee_access_token}&shop_id=${shopee_shop_id}&sign=${sign}&time_range_field=create_time&time_from=${timeFrom}&time_to=${timestamp}&page_size=30&order_status=READY_TO_SHIP`;
        const listResponse = await requestFetch(listUrl);
        const listData = await listResponse.json();
        if (listData.error) {
            console.error('Shopee API Error:', listData.message);
            return;
        }

        const orders = listData.response?.order_list || [];
        if (orders.length === 0) {
            console.log('Nenhum pedido READY_TO_SHIP no momento.');
            return;
        }

        const ptp = require('pdf-to-printer');
        for (const order of orders) {
            const orderSn = String(order.order_sn || '').trim();
            if (!orderSn) continue;
            const markers = orderPrintStatePaths(orderSn);
            if (fs.existsSync(markers.legacy)) continue;

            console.log(`Processando fluxo fiscal e impressão de ${orderSn}...`);
            let currentStage = 'invoice';
            try {
                if (!fs.existsSync(markers.label)) {
                    const invoice = await callVpsShopeeAction('upload_invoice', { order_sn: orderSn });
                    if (!isVpsActionSuccess(invoice)) {
                        console.log(`[${orderSn}] Nota ainda não pronta: ${invoice.data?.message || invoice.data?.error || `HTTP ${invoice.status}`}`);
                        if (requiresHumanIntervention('invoice', invoice)) {
                            await printHumanInterventionReceipt({ settings, shopeeApiUrl, orderSn, stage: 'invoice', resultOrError: invoice });
                        }
                        continue;
                    }

                    currentStage = 'ship_order';
                    let shipment = null;
                    for (let attempt = 1; attempt <= 6; attempt += 1) {
                        shipment = await callVpsShopeeAction('ship_order', { order_sn: orderSn });
                        if (isVpsActionSuccess(shipment)) break;
                        const shipmentError = `${shipment.data?.error || ''} ${shipment.data?.message || ''}`;
                        if (!/invoice|nota fiscal|lack_of_invoice_data|pending/i.test(shipmentError)) break;
                        await delay(2500);
                    }
                    if (!isVpsActionSuccess(shipment)) {
                        console.log(`[${orderSn}] Preparar envio pendente: ${shipment?.data?.message || shipment?.data?.error || `HTTP ${shipment?.status}`}`);
                        if (requiresHumanIntervention('ship_order', shipment)) {
                            await printHumanInterventionReceipt({ settings, shopeeApiUrl, orderSn, stage: 'ship_order', resultOrError: shipment });
                        }
                        continue;
                    }

                    currentStage = 'shipping_document';
                    await delay(2000);
                    const document = await callVpsShopeeAction('get_shipping_document', {
                        order_sn: orderSn,
                        shipping_document_type: 'NORMAL_AIR_WAYBILL',
                    });
                    if (!document.ok || !document.buffer?.length || !document.contentType.includes('pdf')) {
                        console.log(`[${orderSn}] Etiqueta ainda não pronta: ${document.data?.message || document.data?.error || `HTTP ${document.status}`}`);
                        if (requiresHumanIntervention('shipping_document', document)) {
                            await printHumanInterventionReceipt({ settings, shopeeApiUrl, orderSn, stage: 'shipping_document', resultOrError: document });
                        }
                        continue;
                    }

                    currentStage = 'label_print';
                    const labelPath = path.join(shippingLabelsDir, `${orderSn}_etiqueta-10x15.pdf`);
                    fs.writeFileSync(labelPath, await expandShopeeLabelForThermalPaper(document.buffer));
                    console.log(`Enviando etiqueta para: ${shopee_printer_thermal}`);
                    await ptp.print(labelPath, {
                        printer: shopee_printer_thermal,
                        paperSize: '4x6',
                        scale: 'fit',
                    });
                    markPrintStep(markers.label);
                    console.log(`Etiqueta ${orderSn} impressa e marcada.`);
                }

                if (settings.shopee_printer_a4 && !fs.existsSync(markers.summary)) {
                    currentStage = 'summary';
                    const summaryData = await getShopeeOrderSummaryData(settings, shopeeApiUrl, orderSn);
                    const summaryPath = path.join(shippingLabelsDir, `${orderSn}_resumo-separacao-10x15.pdf`);
                    const summaryBuffer = await createShopeeSeparationSummaryPdf(summaryData);
                    if (!summaryBuffer?.length) throw new Error('Resumo de separação vazio.');
                    fs.writeFileSync(summaryPath, summaryBuffer);
                    console.log(`Enviando resumo para: ${settings.shopee_printer_a4}`);
                    await ptp.print(summaryPath, {
                        printer: settings.shopee_printer_a4,
                        paperSize: '80mm',
                        scale: 'fit',
                    });
                    markPrintStep(markers.summary);
                    console.log(`Resumo ${orderSn} impresso e marcado.`);
                }

                if (
                    fs.existsSync(markers.label)
                    && (!settings.shopee_printer_a4 || fs.existsSync(markers.summary))
                ) {
                    markPrintStep(markers.legacy);
                    console.log(`Fluxo ${orderSn} concluído sem repetição.`);
                }
            } catch (orderError) {
                console.error(`Falha no pedido ${orderSn}:`, orderError.message || orderError);
                if (requiresHumanIntervention(currentStage, orderError)) {
                    await printHumanInterventionReceipt({
                        settings,
                        shopeeApiUrl,
                        orderSn,
                        stage: currentStage,
                        resultOrError: orderError,
                    });
                }
            }
            await delay(3000);
        }
    } catch (error) {
        console.error('Erro Fatal no Ciclo:', error);
    } finally {
        loopRunning = false;
    }
}

startLocalServer();
void runLoop();
setInterval(() => void runLoop(), POLLING_INTERVAL);
