import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const script = readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
const panel = readFileSync('pages/admin/settings/components/ShopeePrintersTab.tsx', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');
const summary = readFileSync('scripts/shopee-separation-summary.cjs', 'utf8');
const vpsServer = readFileSync('vps_server.cjs', 'utf8');
const vpsServerMirror = readFileSync('vps_server.js', 'utf8');
const mobilePush = readFileSync('services/mobileSalesPushService.cjs', 'utf8');

assert.match(script, /shippingLabelsDir\s*=\s*path\.join\(__dirname, 'Etiquetas de envio'\)/,
  'etiquetas precisam ficar em uma pasta local dedicada');
assert.match(script, /printedMarkersDir\s*=\s*path\.join\(__dirname, 'shopee_printed'\)/,
  'marcadores de pedidos impressos precisam ficar fora da pasta apagável');
assert.match(script, /clearShippingLabels\(\)[\s\S]*?\.pdf/,
  'a limpeza deve atingir somente PDFs de etiquetas e resumos');
assert.match(script, /shipping_document_type:\s*["']NORMAL_AIR_WAYBILL["']/,
  'a etiqueta normal da Shopee precisa ser usada para permitir o recorte 10x15');
assert.match(script, /expandShopeeLabelForThermalPaper/,
  'a etiqueta da Shopee precisa ser ampliada antes da impressão térmica');

const labelPrints = script.match(/paperSize:\s*'4x6'[\s\S]{0,80}?scale:\s*'fit'/g) || [];
assert.ok(labelPrints.length >= 4,
  'etiqueta de envio precisa usar papel 4x6 e escala fit');
const summaryPrints = script.match(/printer:\s*(?:summaryPrinter|settings\.shopee_printer_a4|targetSummaryPrinter)[\s\S]{0,80}?scale:\s*'fit'/g) || [];
assert.ok(summaryPrints.length >= 4,
  'comprovante/resumo precisa usar escala fit na impressora Comprovante');
assert.match(summary, /RECEIPT_WIDTH_MM\s*=\s*80/,
  'o PDF do comprovante precisa ter largura real de 80 mm');
assert.match(summary, /RECEIPT_MARGIN_MM\s*=\s*5/,
  'o PDF do comprovante precisa reservar margem de 5 mm nos quatro lados');
assert.match(summary, /Number\.POSITIVE_INFINITY/,
  'nomes de produtos precisam quebrar em quantas linhas forem necessarias sem truncamento');
assert.match(panel, /Comprovante 80 mm/,
  'o painel precisa identificar corretamente o papel da impressora de comprovante');
assert.match(panel, /margens de 5 mm/,
  'o painel precisa documentar as margens configuradas no PDF');
assert.match(script, /runPrintFlowTest[\s\S]*?labelPrinter[\s\S]*?summaryPrinter/,
  'o teste precisa enviar conteúdo para as duas térmicas');
assert.match(script, /req\.url === '\/test-flow' && req\.method === 'POST'/,
  'o serviço local precisa expor o fluxo de teste');
assert.match(script, /req\.url === '\/update-service' && req\.method === 'POST'/,
  'o serviço local precisa expor a atualização controlada pelo painel');
assert.match(script, /git',\s*\['pull', '--ff-only', 'origin', 'main'\]/,
  'a atualização local deve aceitar somente avanço rápido da main');
assert.match(script, /server\.listen\(8081, '127\.0\.0\.1'/,
  'o serviço local deve aceitar conexões somente deste computador');

for (const text of [
  'Comprovante 80 mm',
  'Executar fluxo de teste',
  'Limpar arquivos',
  'Atualizar serviço',
  'Etiquetas de envio',
]) {
  assert.match(panel, new RegExp(text), `painel deve manter o texto: ${text}`);
}

assert.match(script, /\['install', '--omit=dev', '--no-audit', '--no-fund'\]/,
  'a atualizaÃ§Ã£o local deve instalar dependÃªncias novas antes de reiniciar');
assert.match(script, /Get-CimInstance Win32_Printer/,
  'a listagem deve ter alternativa nativa do Windows quando pdf-to-printer falhar');
assert.match(packageJson, /"pdf-to-printer":\s*"\^5\.8\.0"/,
  'o serviÃ§o local precisa declarar a dependÃªncia de impressÃ£o');
assert.match(panel, /LOCAL_PRINT_SERVICE_URL\s*=\s*'http:\/\/127\.0\.0\.1:8081'/,
  'o painel precisa usar o loopback IPv4 que o serviço local atende');
assert.doesNotMatch(panel, /http:\/\/localhost:8081/,
  'localhost pode resolver para IPv6 e impedir a comunicação com o serviço IPv4');
assert.match(script, /\/api\/v2\/order\/get_order_detail/,
  'o resumo precisa consultar os itens e o destinatário do pedido');
assert.match(script, /\/api\/v2\/logistics\/get_tracking_number/,
  'o resumo precisa consultar o código de rastreio da Shopee');
assert.match(script, /createShopeeSeparationSummaryPdf/,
  'os fluxos manual e automático precisam usar o resumo próprio 10x15');
assert.match(script, /createShopeeInterventionReceiptPdf/,
  'erros que exigem ação humana precisam gerar comprovante próprio 10x15');
assert.match(script, /requiresHumanIntervention\('invoice'[\s\S]*?printHumanInterventionReceipt/,
  'erros fiscais não transitórios precisam imprimir o aviso operacional');
assert.match(script, /\.intervention-\$\{issueHash\}\.txt/,
  'cada erro precisa de marcador deduplicado para não imprimir em loop');
assert.match(script, /stage === 'shipping_document'[\s\S]*?return true/,
  'falha ao gerar a etiqueta precisa pedir intervenção porque o pedido pode sair de READY_TO_SHIP');
assert.match(script, /'get_stock_locations'[\s\S]*?stockLocation/,
  'o resumo precisa consultar e associar a localização de estoque pelo SKU');
assert.doesNotMatch(script, /NORMAL_PORT_RECEIPT_RETURN/,
  'o recibo portuário da Shopee não deve substituir o resumo de separação');
assert.match(summary, /bcid:\s*'code128'/,
  'o rastreio precisa ser impresso como código de barras Code 128');
assert.match(summary, /Localizacao:[\s\S]*?stockLocation/,
  'cada item precisa imprimir sua localização de depósito');
assert.match(summary, /INTERVENCAO NECESSARIA[\s\S]*?NAO DESPACHAR ATE CORRIGIR/,
  'o comprovante de erro precisa ter alerta claro para bloquear o despacho');
assert.match(packageJson, /"bwip-js":\s*"\^\d+/,
  'a dependência que gera o código de barras precisa estar versionada');

assert.match(script, /async function runLoop\(\)[\s\S]*?'upload_invoice'[\s\S]*?'ship_order'[\s\S]*?'get_shipping_document'/,
  'o fluxo real precisa enviar a nota antes de preparar o envio e baixar a etiqueta');
assert.match(script, /loopRunning[\s\S]*?nova rodada ignorada/,
  'ciclos sobrepostos precisam ser bloqueados para nÃ£o duplicar impressÃµes');
assert.match(script, /\.label\.txt[\s\S]*?\.summary\.txt/,
  'etiqueta e resumo precisam ter marcadores independentes');
assert.match(script, /markPrintStep\(markers\.label\)[\s\S]*?markPrintStep\(markers\.summary\)/,
  'cada impressÃ£o precisa ser marcada imediatamente apÃ³s o respectivo sucesso');
assert.match(vpsServer, /case 'upload_invoice'/,
  'a VPS precisa expor a etapa controlada de envio da NF-e para a Shopee');
assert.match(vpsServer, /\/api\/v2\/order\/upload_invoice_doc/,
  'a NF-e precisa usar o endpoint oficial de upload de documento da Shopee');
assert.match(vpsServer, /formData\.append\('order_sn'[\s\S]*?formData\.append\('file_type', '4'\)[\s\S]*?formData\.append\(\s*'file'/,
  'o upload precisa relacionar pedido e XML fiscal no multipart');
assert.match(vpsServer, /numeroPedidoLoja[\s\S]*?orderSn/,
  'a NF-e do Bling precisa ser localizada pelo nÃºmero exato do pedido Shopee');
assert.match(vpsServer, /notifyShopeeFulfillmentErrorVps/,
  'erros fiscais precisam acionar o aviso operacional');
assert.match(vpsServer, /case 'get_stock_locations'[\s\S]*?getShopeeStockLocationsVps/,
  'a VPS precisa oferecer a consulta autenticada de localizações por SKU');
assert.match(vpsServer, /product_stock_locations[\s\S]*?stock_deposits[\s\S]*?stock_locations/,
  'a localização deve vir da distribuição real de estoque');
assert.match(mobilePush, /sendOperationalAlert/,
  'o GestÃ£o MDV precisa receber alertas operacionais deduplicados');
assert.equal(vpsServer, vpsServerMirror,
  'vps_server.js e vps_server.cjs devem permanecer idÃªnticos');

console.log('Shopee dual thermal print flow regression checks passed.');
