import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { formatReferenceNumber } = await import('../utils/referenceNumber.ts');
const sale = readFileSync('services/saleService.ts', 'utf8');
const order = readFileSync('services/orderService.ts', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

assert.equal(formatReferenceNumber('ae4b6393-28eb-4718-8655-3a530529e991'), 'AE4B6393');
assert.match(sale, /Venda #\$\{formatReferenceNumber\(sale\.id\)\}/, 'Bling sale note must use the visible sale number');
assert.match(sale, /Cancelamento PDV #\$\{formatReferenceNumber\(id\)\}/, 'Bling cancellation note must use the visible sale number');
assert.match(order, /Pedido online #\$\{formatReferenceNumber\(order\.id\)\}/, 'online-order notes must use the visible order number');
assert.match(server, /SELECT COUNT\(\*\) FROM units u WHERE u\.product_id = p\.id/, 'Bling duplicate resolution must prefer the product that owns serialized units');

console.log('Bling stock reference number checks passed');
