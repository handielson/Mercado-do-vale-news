import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync('services/mercadoLivreServer.cjs', 'utf8');
const vps = fs.readFileSync('vps_server.cjs', 'utf8');
const legacy = fs.readFileSync('server.js', 'utf8');
const printer = fs.readFileSync('scripts/shopee-auto-print.cjs', 'utf8');

for (const route of [
  '/mercado-livre/webhook',
  '/mercado-livre/oauth/auth',
  '/mercado-livre/oauth/callback',
  '/mercado-livre/print-jobs/next',
  '/mercado-livre/print-jobs/:shipmentId/label',
  '/mercado-livre/print-jobs/:shipmentId/declaration',
  '/mercado-livre/print-jobs/:shipmentId/step',
  '/mercado-livre/print-jobs/:shipmentId/complete',
  '/mercado-livre/products/link',
]) assert.ok(moduleSource.includes(route), `rota ausente: ${route}`);

assert.ok(moduleSource.includes('/dce/emission'), 'emissao DC-e ausente');
assert.ok(moduleSource.includes('/shipment_labels'), 'download de etiqueta ausente');
assert.ok(moduleSource.includes('/dce/info/'), 'download do PDF da declaracao DC-e ausente');
assert.ok(moduleSource.includes('declaration_printed_at'), 'fila deve controlar declaracao impressa sem duplicar etiqueta');
assert.ok(moduleSource.includes('mercado_livre_webhook_events'), 'deduplicacao de webhook ausente');
assert.ok(moduleSource.includes('mercado_livre_print_jobs'), 'fila de impressao ausente');
assert.ok(moduleSource.includes('refreshPromise'), 'refresh OAuth precisa de trava local');
assert.ok(moduleSource.includes("code_challenge_method', 'S256'"), 'OAuth deve exigir PKCE S256');
assert.ok(moduleSource.includes('code_verifier: oauthState.code_verifier'), 'callback deve comprovar o PKCE');
assert.ok(!moduleSource.includes("accessToken: settings.accessToken"), 'status nao pode vazar token');

for (const source of [vps, legacy]) {
  assert.ok(source.includes('registerMercadoLivreRoutes'), 'servidor sem rotas Mercado Livre');
  assert.ok(source.includes('syncMercadoLivreStockFromBlingTargets'), 'Bling sem propagacao ao Mercado Livre');
  assert.ok(source.includes('mercadoLivre'), 'resultado da sincronizacao deve identificar o destino');
  assert.ok(source.includes('saleDetected: true'), 'webhook Bling deve registrar a venda sem baixar duas vezes');
  assert.ok(source.includes("stockAction: 'awaiting_stock_webhook'"), 'venda deve aguardar o evento fisico de estoque');
}

assert.ok(printer.includes('runMercadoLivreLoop'), 'servico local sem consumidor Mercado Livre');
assert.ok(printer.includes("paperSize: '4x6'"), 'etiqueta deve usar papel termico 10x15');
assert.ok(printer.includes('/print-jobs/next'), 'servico local deve consumir a fila idempotente');
assert.ok(printer.includes("markMercadoLivrePrintStep(shipmentId, 'label')"), 'etiqueta Mercado Livre deve ser marcada apos imprimir');
assert.ok(printer.includes("markMercadoLivrePrintStep(shipmentId, 'declaration')"), 'declaracao Mercado Livre deve ser impressa separadamente');
assert.ok(printer.includes("markMercadoLivrePrintStep(shipmentId, 'summary')"), 'comprovante Mercado Livre deve ser impresso separadamente');
assert.ok(printer.includes('printer: labelPrinter'), 'etiqueta e declaracao devem usar a termica ZD configurada');
assert.ok(printer.includes('printer: summaryPrinter'), 'comprovante deve usar a impressora Comprovante configurada');
assert.ok(printer.includes('retryable: Number(error.status) === 409'), 'DC-e ainda em processamento deve voltar para a fila');

console.log('Mercado Livre integration static contract: OK');
