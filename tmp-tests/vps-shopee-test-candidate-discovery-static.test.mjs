import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-test-candidate-discovery.cjs', 'utf8');

assert.match(source, /dotenv\/config/, 'script must load local env files without printing them');
assert.match(source, /SUPABASE_URL|VITE_SUPABASE_URL/, 'script must read Supabase URL from env');
assert.match(source, /SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_KEY/, 'script must read Supabase key from env');
assert.match(source, /shopee_item_id=not\.is\.null|shopee_products/, 'script must look for Shopee-linked products');
assert.match(source, /test_like/, 'script must classify likely test products without printing names');
assert.match(source, /sanitizeProductCandidate/, 'script must sanitize product candidates');
assert.doesNotMatch(source, /console\.log\(.*sku|console\.log\(.*name|console\.log\(.*shopee_item_id|console\.log\(.*shopee_model_id/i, 'script must not print raw product identifying fields');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|client_secret/i, 'script must not mention or print Shopee secrets');

console.log('vps Shopee test candidate discovery static ok');
