import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
const modal = readFileSync('components/admin/sales/MarketplaceSaleDetailsModal.tsx', 'utf8');
const receipt = readFileSync('utils/printMarketplaceSaleReceipt.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');

assert.match(service, /PROCESSED:\s*'Pedido processado'/);
assert.match(service, /getMarketplaceSaleDetail/);
assert.match(service, /connection_id/);
assert.match(modal, /Situação no marketplace/);
assert.match(modal, /Imprimir comprovante/);
assert.match(modal, /SaleItemInventoryInfo/);
assert.match(receipt, /receipt_width/);
assert.match(receipt, /window\.print/);
assert.match(server, /loadMobileShopeeSalesVps\(1, saleId, connectionId\)/);
console.log('marketplace sale details static checks passed');
