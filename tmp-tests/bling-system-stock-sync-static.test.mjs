import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const blingService = readFileSync(new URL('../services/blingService.ts', import.meta.url), 'utf8');
assert.match(blingService, /buildComboStockDeductionTargets/);
assert.match(blingService, /options\?: \{ comboSelections\?: BlingComboSelection\[\] \}/);
assert.match(blingService, /target\.productId/);

const saleService = readFileSync(new URL('../services/saleService.ts', import.meta.url), 'utf8');
assert.match(saleService, /syncStockToBling\(/);
assert.match(saleService, /comboSelections: item\.comboSelections/);

const orderService = readFileSync(new URL('../services/orderService.ts', import.meta.url), 'utf8');
assert.match(orderService, /import \{ syncStockToBling \} from '\.\/blingService'/);
assert.match(orderService, /combo_selections: item\.comboSelections/);
assert.match(orderService, /syncOrderItemsStockToBling\(/);
assert.match(orderService, /alreadyHadStockDecrement/);
assert.match(orderService, /combo_selections\)/);

const checkoutPage = readFileSync(new URL('../pages/store/CheckoutPage.tsx', import.meta.url), 'utf8');
assert.match(checkoutPage, /comboSelections: i\.comboSelections/);

assert.match(orderService, /\/table-data\/order_items\/bulk/, 'order items must be persisted through the VPS table-data endpoint');
assert.match(orderService, /serializeOrderItemRowForTable/, 'combo selections must be serialized before VPS persistence');
assert.doesNotMatch(orderService, /supabase\.(?:from|rpc)|from ['"]\.\/supabase['"]/, 'online orders must not restore Supabase persistence');

console.log('bling system stock sync static tests passed');
