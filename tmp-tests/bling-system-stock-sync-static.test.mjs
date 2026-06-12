import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const blingService = readFileSync(new URL('../services/blingService.ts', import.meta.url), 'utf8');
assert.match(blingService, /buildComboStockDeductionTargets/);
assert.match(blingService, /options\?: \{ comboSelections\?: BlingComboSelection\[\]; unitPriceCents\?: number \}/);
assert.match(blingService, /target\.productId/);
assert.match(blingService, /const unitPrice =[\s\S]*Number\(options\?\.unitPriceCents\) \/ 100[\s\S]*\.toFixed\(2\)/);

const saleService = readFileSync(new URL('../services/saleService.ts', import.meta.url), 'utf8');
assert.match(saleService, /syncStockToBling\(/);
assert.match(saleService, /comboSelections: item\.comboSelections/);
assert.match(saleService, /unitPriceCents: item\.unit_price/);

const orderService = readFileSync(new URL('../services/orderService.ts', import.meta.url), 'utf8');
assert.match(orderService, /import \{ syncStockToBling \} from '\.\/blingService'/);
assert.match(orderService, /combo_selections: item\.comboSelections/);
assert.match(orderService, /syncOrderItemsStockToBling\(/);
assert.match(orderService, /alreadyHadStockDecrement/);
assert.match(orderService, /combo_selections\)/);
assert.match(orderService, /unitPriceCents: Number\(item\.unit_price\) \|\| undefined/);

const checkoutPage = readFileSync(new URL('../pages/store/CheckoutPage.tsx', import.meta.url), 'utf8');
assert.match(checkoutPage, /comboSelections: i\.comboSelections/);

const migrationUrl = new URL('../supabase/migrations/20260516194000_add_combo_selections_to_order_items.sql', import.meta.url);
if (existsSync(migrationUrl)) {
  const migration = readFileSync(migrationUrl, 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS combo_selections JSONB/);
}

console.log('bling system stock sync static tests passed');
