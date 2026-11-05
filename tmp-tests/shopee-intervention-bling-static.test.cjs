// intervention-header-no-overlap-v1 + bling-disconnected-instructions-v1 + bling-refresh-diagnostics-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { interventionInstructions } = require('../scripts/shopee-auto-print.cjs');

test('falha de renovação do Bling pede para reconectar, não para corrigir NCM', () => {
  const text = interventionInstructions('invoice', 'Renovação do Bling indisponível. Tente novamente mais tarde.');
  assert.match(text, /Reconectar Bling/);
  assert.match(text, /admin\/settings\/bling/);
  assert.doesNotMatch(text, /NCM/);
  assert.match(interventionInstructions('invoice', 'Rejeicao: NCM inexistente'), /NCM/, 'erro fiscal continua com a instrução fiscal');
});

test('cabeçalho do comprovante de intervenção não sobrepõe título e "SHOPEE | n/n"', () => {
  const src = fs.readFileSync(path.join(__dirname, '../scripts/shopee-separation-summary.cjs'), 'utf8');
  const block = src.slice(src.indexOf('async function createShopeeInterventionReceiptPdf'), src.indexOf("page.drawText(`PEDIDO:"));
  const titleY = Number(block.match(/'INTERVENCAO NECESSARIA', \{[^}]*y: (\d+)/)[1]);
  const tagY = Number(block.match(/SHOPEE \| \$\{pageIndex \+ 1\}[\s\S]*?y: (\d+)/)[1]);
  assert.ok(titleY - tagY >= 10, `linhas separadas (título ${titleY}, etiqueta ${tagY})`);
  assert.ok(tagY >= 379 + 3, 'etiqueta dentro da faixa vermelha');
});

test('renovação do Bling registra status e código, sem token', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const fn = src.slice(src.indexOf('async function refreshBlingStoredAccessTokenVps'), src.indexOf("await vpsDbPatch('company_settings'", src.indexOf('async function refreshBlingStoredAccessTokenVps')));
    assert.match(fn, /\[bling-token\] refresh failed/);
    const logCall = fn.slice(fn.indexOf("console.error('[bling-token]"), fn.indexOf('});', fn.indexOf("console.error('[bling-token]")));
    assert.doesNotMatch(logCall, /refresh_token|access_token|client_secret|settings\./);
  }
});
