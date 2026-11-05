// receipt-stock-location-v1: comprovante de separação (Shopee M/G, Mercado Livre e TikTok) mostra, em destaque,
// o local do estoque com a quantidade em cada local e o estoque total do item.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { receiptStockInfo, receiptStockMap } = require('../scripts/receipt-stock-location.cjs');

test('monta local com quantidade, maior primeiro, sem locais zerados; aceita resposta antiga', () => {
  const info = receiptStockInfo({ sku: 'A', locations: ['Loja / P3 N3', 'Loja / Entrada', 'Dep / Caixa 12'],
    location_details: [{ label: 'Loja / P3 N3', quantity: 1 }, { label: 'Loja / Entrada', quantity: 0 }, { label: 'Dep / Caixa 12', quantity: 5 }], stock_total: 6 });
  assert.deepEqual(info, { stockLocation: 'Dep / Caixa 12 (5 un.) | Loja / P3 N3 (1 un.)', stockTotal: 6, productUrl: '' });
  assert.deepEqual(receiptStockInfo({ locations: ['A', 'B'] }), { stockLocation: 'A | B', stockTotal: null, productUrl: '' }, 'API antiga');
  assert.deepEqual(receiptStockInfo('X'), { stockLocation: 'X', stockTotal: null, productUrl: '' });
  assert.deepEqual(receiptStockInfo({ location_details: [{ label: 'L', quantity: 0 }], stock_total: 0 }), { stockLocation: 'L (0 un.)', stockTotal: 0, productUrl: '' });
  assert.equal(receiptStockMap([{ sku: 'abc', locations: ['L'] }]).ABC.stockLocation, 'L');
});

test('API devolve quantidade física por local e o estoque total (js e cjs), mantendo "locations"', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /p\.stock_quantity,\n\s+sd\.name AS deposit_name/, `${file}: lê o estoque do cadastro`);
    assert.match(src, /location_details: \[\],\n\s+stock_total: null,/, `${file}: campos novos`);
    assert.match(src, /const quantity = Number\(row\?\.quantity\) \|\| 0; \/\/ físico no local/, `${file}: quantidade física`);
    assert.match(src, /if \(!item\.locations\.includes\(label\)\) item\.locations\.push\(label\);/, `${file}: compatível com agentes antigos`);
  }
});

test('os três agentes repassam o estoque total e os dois PDFs desenham o quadro', () => {
  const auto = fs.readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
  assert.equal((auto.match(/return receiptStockMap\(result\.data\?\.items\); \/\/ receipt-stock-location-v1/g) || []).length, 2, 'ML e TikTok');
  assert.equal((auto.match(/stockTotal: info\.stockTotal, productUrl/g) || []).length, 2, 'Shopee (dois montadores)');
  assert.match(fs.readFileSync('scripts/mercado-livre-print-agent.cjs', 'utf8'), /stockTotal: info\.stockTotal \?\? null/);
  assert.match(fs.readFileSync('scripts/tiktok-shop-print-agent.cjs', 'utf8'), /stockTotal: info\.stockTotal \?\? null/);
  const ml = fs.readFileSync('scripts/mercado-livre-print-core.cjs', 'utf8');
  assert.match(ml, /`LOCAL: \$\{item\.stockLocation/);
  assert.match(ml, /ESTOQUE TOTAL: \$\{/);
  const shopee = fs.readFileSync('scripts/shopee-separation-summary.cjs', 'utf8');
  assert.match(shopee, /`LOCAL: \$\{item\?\.stockLocation/);
  assert.match(shopee, /`ESTOQUE TOTAL: \$\{/);
});

test('PDFs geram com o quadro (Shopee e ML/TikTok)', async () => {
  const { createShopeeSeparationSummaryPdf } = require('../scripts/shopee-separation-summary.cjs');
  const { createMercadoLivreSummaryPdf } = require('../scripts/mercado-livre-print-core.cjs');
  const items = [{ name: 'Item', sku: 'A', quantity: 1, stockLocation: 'Loja / P3 N3 (1 un.)', stockTotal: 1 }];
  const order = { marketplaceName: 'SHOPEE M', orderSn: '1', items };
  assert.ok((await createShopeeSeparationSummaryPdf(order)).length > 1000);
  assert.ok((await createMercadoLivreSummaryPdf({ ...order, marketplaceName: 'MERCADO LIVRE' })).length > 1000);
});

// receipt-product-qr-v1: QR com o link curto da página do produto (foto, nome e variação) em cada item.
test('QR: só link do próprio site, curto pelo ID, nos dois geradores e na API', async () => {
  const ok = receiptStockInfo({ locations: ['L'], product_url: 'https://mercadodovale.com.br/produto/8177badc-47be-4daa-bf23-d29f05ef54bc' });
  assert.equal(ok.productUrl, 'https://mercadodovale.com.br/produto/8177badc-47be-4daa-bf23-d29f05ef54bc');
  assert.equal(receiptStockInfo({ locations: ['L'], product_url: 'https://evil.example/produto/x' }).productUrl, '', 'nunca QR para outro domínio');
  const { productQrPng } = require('../scripts/mercado-livre-print-core.cjs');
  assert.ok(Buffer.isBuffer(await productQrPng(ok.productUrl)), 'gera o QR');
  assert.equal(await productQrPng('https://evil.example/produto/x'), null);
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    assert.match(fs.readFileSync(file, 'utf8'), /item\.product_url = `https:\/\/mercadodovale\.com\.br\/produto\/\$\{encodeURIComponent\(String\(row\.product_id\)\)\}`/, `${file}: link curto pelo ID`);
  }
  assert.match(fs.readFileSync('scripts/shopee-separation-summary.cjs', 'utf8'), /bcid: 'qrcode', text: layout\.productUrl/);
  for (const file of ['scripts/shopee-auto-print.cjs', 'scripts/mercado-livre-print-agent.cjs', 'scripts/tiktok-shop-print-agent.cjs']) {
    assert.match(fs.readFileSync(file, 'utf8'), /productUrl: info\.productUrl \|\| ''/, `${file}: repassa o link`);
  }
  const { createMercadoLivreSummaryPdf } = require('../scripts/mercado-livre-print-core.cjs');
  const withQr = await createMercadoLivreSummaryPdf({ marketplaceName: 'MERCADO LIVRE', orderSn: '1', items: [{ name: 'Item', sku: 'A', quantity: 1, stockLocation: 'L', stockTotal: 1, productUrl: ok.productUrl }] });
  const withoutQr = await createMercadoLivreSummaryPdf({ marketplaceName: 'MERCADO LIVRE', orderSn: '1', items: [{ name: 'Item', sku: 'A', quantity: 1, stockLocation: 'L', stockTotal: 1 }] });
  assert.ok(withQr.length > withoutQr.length + 200, 'o PDF com link traz a imagem do QR');
});

test('última peça: estoque zerado aparece com o aviso nos dois comprovantes', () => {
  assert.match(fs.readFileSync('scripts/mercado-livre-print-core.cjs', 'utf8'), /<= 0 \? ' - ULTIMA PECA' : ''/);
  assert.match(fs.readFileSync('scripts/shopee-separation-summary.cjs', 'utf8'), /<= 0 \? ' - ULTIMA PECA' : ''/);
});
