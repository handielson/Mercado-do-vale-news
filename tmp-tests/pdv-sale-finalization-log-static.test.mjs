import assert from 'node:assert/strict';
import fs from 'node:fs';

const pdvPage = fs.readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const saleService = fs.readFileSync('services/saleService.ts', 'utf8');
const saleTypes = fs.readFileSync('types/sale.ts', 'utf8');
const saleDetails = fs.readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const salesPage = fs.readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const vpsServer = fs.readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = fs.readFileSync('vps_server.cjs', 'utf8');
const finalizationLogUtil = fs.readFileSync('utils/pdvSaleFinalizationLog.ts', 'utf8');

for (const field of ['finalization_status', 'finalization_log', 'finalization_error_summary']) {
  assert.match(saleTypes, new RegExp(`${field}\\?`), `types/sale.ts must type ${field}`);
  assert.match(saleService, new RegExp(field, 'g'), `saleService.ts must persist ${field}`);
  assert.match(vpsServer, new RegExp(`addColumnIfMissing\\('sales', '${field}'`), `vps_server.js must migrate sales.${field}`);
  assert.match(vpsServerCjs, new RegExp(`addColumnIfMissing\\('sales', '${field}'`), `vps_server.cjs must migrate sales.${field}`);
}

assert.match(pdvPage, /buildPdvSaleFinalizationLog/, 'PDV must build a complete finalization log before createSale');
assert.doesNotMatch(pdvPage, /savePdvSaleFinalizationLog/, 'PDV must not persist finalization history in browser localStorage');
assert.match(pdvPage, /saleInput\.finalization_log\s*=\s*serializePdvSaleFinalizationLog\(finalizationLog\)/, 'PDV must send finalization log to VPS through sale payload');
assert.doesNotMatch(finalizationLogUtil, /pdv_sale_finalization_log/, 'finalization logs must not be stored in browser local history');
assert.match(pdvPage, /downloadPdvSaleFinalizationLogText/, 'PDV must offer TXT download for debugging/recovery');
assert.match(pdvPage, /copyPdvSaleFinalizationLogText/, 'PDV must offer copy-to-clipboard for debugging');
assert.match(pdvPage, /Venda registrada com erros para corrigir/, 'PDV must warn when sale is saved with correction errors');
assert.match(pdvPage, /Venda registrada com sucesso/, 'PDV must show success status when no finalization errors happened');

assert.match(saleService, /recordFinalizationIssue/, 'saleService must collect finalization issues instead of throwing immediately');
assert.match(saleService, /finalization_status\s*=\s*finalizationIssues\.length > 0 \? 'needs_review' : 'success'/, 'saleService must derive finalization status from collected issues');
assert.doesNotMatch(saleService, /catch \(itemsError\)[\s\S]{0,220}deleteSaleRow/, 'item insertion failure must not delete an already-created sale');
assert.doesNotMatch(saleService, /catch \(err\)[\s\S]{0,420}deleteSaleRow/, 'serialized unit failure must not delete an already-created sale');
assert.doesNotMatch(saleService, /catch \(debtError\)[\s\S]{0,260}deleteSaleRow/, 'debt failure must not delete an already-created sale');

assert.match(saleDetails, /Copiar log/, 'sale details modal must expose copy log action');
assert.match(saleDetails, /Baixar TXT/, 'sale details modal must expose TXT download action');
assert.match(saleDetails, /Venda registrada com erros para corrigir/, 'sale details modal must show correction-needed status');
assert.match(salesPage, /needs_review/, 'sales table must flag needs_review sales');
assert.match(
  finalizationLogUtil,
  /sale_id\.split\('-'\)\[0\]/,
  'downloaded PDV log filename must use the sale/order number when available'
);

console.log('pdv-sale-finalization-log-static.test.mjs: ok');
