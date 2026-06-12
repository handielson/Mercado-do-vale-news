import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf8');

const customerTypes = read('types/customer.ts');
const customerService = read('services/customers.ts');
const customerSection = read('components/pdv/CustomerSection.tsx');
const pdvPage = read('pages/pdv/PDVPage.tsx');
const saleService = read('services/saleService.ts');
const vpsServer = read('vps_server.js');

assert.match(customerTypes, /is_walk_in_customer\?: boolean/, 'Customer types must expose the walk-in customer flag');

assert.match(customerService, /getOrCreateWalkInCustomer/, 'Customer service must expose a get-or-create helper');
assert.match(customerService, /Cliente Balc[aã]o/, 'Customer service must create the Cliente Balcao technical profile');
assert.match(customerService, /is_walk_in_customer: walkInCustomer === true/, 'Customer service must normalize the walk-in flag');
assert.match(customerService, /filters\?\.is_walk_in_customer/, 'Customer service must support filtering walk-in customers');

assert.match(customerSection, /Venda r[aá]pida/, 'PDV customer selector must show a quick-sale action');
assert.match(customerSection, /onSelectWalkInCustomer/, 'PDV customer selector must expose the quick-sale callback');

assert.match(pdvPage, /handleSelectWalkInCustomer/, 'PDV page must handle walk-in customer selection');
assert.match(pdvPage, /getOrCreateWalkInCustomer/, 'PDV page must load or create Cliente Balcao');
assert.match(pdvPage, /(handleDeliveryChange|setDeliveryType)\('store_pickup'/, 'Quick sale must default to store pickup');
assert.match(pdvPage, /!isWalkInCustomer\(selectedCustomer\)[\s\S]{0,800}earnCoinsForPurchase/, 'Quick sale must not earn Moedas do Vale');

assert.match(saleService, /isWalkInCustomerRow/, 'Sale service must detect Cliente Balcao rows');
assert.match(saleService, /const walkInCustomer = await isWalkInCustomerId\(saleInput\.customer_id\)/, 'Sale service must check the sale customer before benefits');
assert.match(saleService, /!walkInCustomer[\s\S]{0,500}grantScreenProtectorBenefit/, 'Sale service must skip automatic benefits for Cliente Balcao');

assert.match(vpsServer, /addColumnIfMissing\('customers', 'is_walk_in_customer'/, 'VPS schema must migrate the walk-in customer flag');

console.log('PDV walk-in customer static checks passed');
