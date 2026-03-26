const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

// Configs fixas
const DB_URL = process.env.VITE_SUPABASE_URL; // Defina no seu .env ou Variaveis de Ambiente do Windows
const DB_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutos

if (!DB_URL || !DB_KEY) {
    console.error("ERRO: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar defindos.");
    process.exit(1);
}

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

async function getCompanySettings() {
    const { data, error } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token, shopee_printer_thermal, shopee_printer_a4')
        .limit(1)
        .single();
    if (error) throw error;
    return data;
}

// Função para iniciar servidor web local para escolher a impressora
function startLocalServer() {
    const server = http.createServer((req, res) => {
        if (req.url === '/') {
            // Requer node_modules: npm install --save pdf-to-printer (que contém getPrinters())
            try {
                const ptp = require('pdf-to-printer');
                ptp.getPrinters().then(printers => {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <html>
                            <head><title>Impressoras Shopee</title></head>
                            <body style="font-family: sans-serif; padding: 2rem;">
                                <h2>Suas impressoras detectadas no Windows:</h2>
                                <ul>${printers.map(p => `<li>${p.name}</li>`).join('')}</ul>
                                <p>Volte ao painel Admin do site e cole o nome exato na Aba "Impressoras" da tela da Shopee.</p>
                            </body>
                        </html>
                    `);
                });
            } catch(e) {
                res.writeHead(500);
                res.end("Instale npm i pdf-to-printer para ver a lista!");
            }
        }
    });
    server.listen(8080, () => {
        console.log("Servidor local ativo! Abra http://localhost:8080 para ver as impressoras do Windows.");
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
            
            // 2. Tentar baixar a Awb (shipping document)
            const pathDoc = '/api/v2/logistics/download_shipping_document';
            const tsDoc = Math.floor(Date.now() / 1000);
            const signDoc = generateSign(shopee_partner_id, shopee_partner_key, pathDoc, tsDoc, shopee_access_token, shopee_shop_id);

            const docPayload = {
                order_list: [{ order_sn }],
                shipping_document_type: "THERMAL_AIR_WAYBILL"
            };

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
