import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supabaseSql = readFileSync('supabase/add_product_offer_fields.sql', 'utf8');
const vpsSql = readFileSync('migrations/vps-add-product-offer-fields.sql', 'utf8');

for (const sql of [supabaseSql, vpsSql]) {
  assert.match(sql, /offer_type/i);
  assert.match(sql, /offer_parent_product_id/i);
  assert.match(sql, /offer_visibility/i);
  assert.match(sql, /shopee_strategy/i);
  assert.match(sql, /shopee_offer_status/i);
  assert.match(sql, /shopee_offer_error/i);
}

assert.match(vpsSql, /ALTER TABLE products\s+ADD COLUMN(?: IF NOT EXISTS)? offer_type/i);
assert.match(supabaseSql, /ALTER TABLE public\.products/i);
assert.match(supabaseSql, /CREATE INDEX IF NOT EXISTS idx_products_offer_parent/i);
assert.match(vpsSql, /information_schema\.statistics/i);
assert.match(vpsSql, /idx_products_offer_parent/i);

console.log('product offer schema static checks passed');
