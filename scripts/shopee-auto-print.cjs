const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configs fixas
const DB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://cqbdyxxzmkgeghwkozts.supabase.co"; 
const DB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDczOTYsImV4cCI6MjA4NTQ4MzM5Nn0.fqbVtqM6x-BuHbREQqXXJpX_T5l4z1Exw_4DEgPr3nU";
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutos

const supabase = createClient(DB_URL, DB_KEY);
const printedDir = path.join(__dirname, 'shopee_printed');

if (!fs.existsSync(printedDir)) {
    fs.mkdirSync(printedDir, { recursive: true });
}

// Para assinar requisições da Shopee Open API v2
function generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
    const baseStr = partnerId + apiPath + timestamp + accessToken + shopId;
    return crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
}

const VPS_API_URL = process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br';

async function getCompanySettings() {
    console.log("-> Lendo extensoes do banco Split-Brain (VPS para Impressoras, Supabase para Tokens)...");
    let vpsData = {};
    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const res = await fetch(`${VPS_API_URL}/company-settings`);
        if (res.ok) {
            vpsData = await res.json();
        }
    } catch (e) {
        console.error('Falha não-critica ao ler impressoras da VPS:', e.message);
    }

    // A fonte de verdade dos TOKENS da Shopee e do Partner Key é o Supabase original!
    const { data: supaData, error } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token, shopee_refresh_token')
        .limit(1)
        .single();
    
    if (error) throw error;

    return {
        ...supaData,
        shopee_printer_thermal: vpsData.shopee_printer_thermal || supaData.shopee_printer_thermal,
        shopee_printer_a4: vpsData.shopee_printer_a4 || supaData.shopee_printer_a4
    };
}

// Função para iniciar servidor web local para escolher a impressora
function startLocalServer() {
    const server = http.createServer((req, res) => {
        // CORS headers - needed because browser HTTPS calls localhost HTTP
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        if (req.url === '/') {
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
                                body: JSON.stringify({ order_list: [{ order_sn: orderSn }], shipping_document_type: "THERMAL_AIR_WAYBILL" })
                            });
                            // Wait 2 seconds for Shopee to build the PDF internally
                            await new Promise(r => setTimeout(r, 2000));
                            
                            const rDoc = await fetch(urlDoc, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order_list: [{ order_sn: orderSn }], shipping_document_type: "THERMAL_AIR_WAYBILL" })
                            });
                            if (rDoc.headers.get('content-type')?.includes('pdf')) {
                                const pdfBuffer = await rDoc.arrayBuffer();
                                const tempPdfPath = path.join(printedDir, `MANUAL_${orderSn}_awb.pdf`);
                                fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));
                                await ptp.print(tempPdfPath, { printer: settings.shopee_printer_thermal });
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
                            const rPkg = await fetch(urlDoc, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ order_list: [{ order_sn: orderSn }], shipping_document_type: "NORMAL_PORT_RECEIPT_RETURN" })
                            });
                            if (rPkg.headers.get('content-type')?.includes('pdf')) {
                                const pdfPkgBuffer = await rPkg.arrayBuffer();
                                const tempPkgPath = path.join(printedDir, `MANUAL_${orderSn}_packing.pdf`);
                                fs.writeFileSync(tempPkgPath, Buffer.from(pdfPkgBuffer));
                                await ptp.print(tempPkgPath, { printer: targetSummaryPrinter });
                                console.log(`[MANUAL PRINT] Resumo enviado!`);
                            }
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
    server.listen(8081, () => {
        console.log("Servidor local ativo! Escutando na porta 8081.");
    });
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function runLoop() {
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
            const markerFile = path.join(printedDir, `${order_sn}.txt`);
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
                shipping_document_type: "THERMAL_AIR_WAYBILL"
            };

            // Request generation
            await fetch(urlCreate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_list: [{ order_sn }], shipping_document_type: "THERMAL_AIR_WAYBILL", tracking_number: "" })
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
                const tempPdfPath = path.join(printedDir, `${order_sn}_awb.pdf`);
                fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));
                
                console.log(`Enviando para impressora: ${shopee_printer_thermal}`);
                try {
                    await ptp.print(tempPdfPath, { printer: shopee_printer_thermal });
                    console.log(`Sucesso ao imprimir ETIQUETA ${order_sn}!`);
                    
                    // --- IMPRIMIR RESUMO / PACKING LIST na A4 ---
                    if (settings.shopee_printer_a4) {
                        try {
                            console.log(`Baixando Resumo/Packing List para ${order_sn}...`);
                            const docPkld = { order_list: [{ order_sn }], shipping_document_type: "NORMAL_PORT_RECEIPT_RETURN" };
                            const rPkg = await fetch(urlDoc, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(docPkld)
                            });
                            if (rPkg.headers.get('content-type')?.includes('pdf')) {
                                const pdfPkgBuffer = await rPkg.arrayBuffer();
                                const tempPkgPath = path.join(printedDir, `${order_sn}_packing.pdf`);
                                fs.writeFileSync(tempPkgPath, Buffer.from(pdfPkgBuffer));
                                console.log(`Enviando Resumo para impressora: ${settings.shopee_printer_a4}`);
                                await ptp.print(tempPkgPath, { printer: settings.shopee_printer_a4 });
                                console.log(`Sucesso ao imprimir RESUMO ${order_sn}!`);
                            }
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

startLocalServer();
runLoop();
setInterval(runLoop, POLLING_INTERVAL);
