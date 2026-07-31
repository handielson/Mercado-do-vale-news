import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleService = readFileSync('services/saleService.ts', 'utf8');
const customer = readFileSync('pages/customers/CustomerDetailsPage.tsx', 'utf8');
const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.match(saleService, /hasIdentifier && !serialized\?\.unitId/, 'sale must reject a serialized identifier without a real unit id');
assert.match(customer, /getWarrantySaleItems\(sale\.items\)/, 'customer warranty reprint must select the serialized phone, not the first accessory');
assert.doesNotMatch(customer, /sale\.items\.slice\(0, 1\)/, 'warranty must never pick the first arbitrary sale item');
assert.match(customer, /getSaleItemRecordedIdentifier\(item\)/, 'legacy reprint must use the identifier recorded on the sale item');
assert.match(modal, /getWarrantySaleItems\(sale\.items\)/, 'admin warranty reprint must also support recorded legacy identifiers');

console.log('sale serialized integrity static checks passed');
