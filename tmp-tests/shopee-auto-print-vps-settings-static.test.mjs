import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('scripts/shopee-auto-print.cjs', 'utf8');

const forbidden = [
  '@supabase/supabase-js',
  'createClient',
  'VITE_SUPABASE',
  'SUPABASE_',
  'supabase.co',
  'supabase.from',
  'Split-Brain',
];

for (const token of forbidden) {
  assert.equal(
    source.includes(token),
    false,
    `scripts/shopee-auto-print.cjs must not depend on Supabase directly: ${token}`
  );
}

assert.match(source, /VPS_API_URL/, 'auto-print must read Shopee settings from the VPS API');
assert.match(source, /\/company-settings/, 'auto-print must use the protected VPS company-settings endpoint');
assert.match(source, /x-sync-key/, 'auto-print must send the VPS sync key header');

for (const field of [
  'shopee_partner_id',
  'shopee_partner_key',
  'shopee_shop_id',
  'shopee_access_token',
  'shopee_printer_thermal',
  'shopee_printer_a4',
]) {
  assert.match(source, new RegExp(field), `auto-print must preserve ${field}`);
}

console.log('shopee auto-print now reads Shopee settings from the protected VPS API.');
