import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-shopee-full-catalog-guarded-check.cjs', 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must target the VPS API host by default');
assert.match(source, /CONFIRM_SHOPEE_FULL_CATALOG_READ/, 'script must require an explicit full catalog confirmation');
assert.match(source, /I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ/, 'script must use a hard-to-accidentally-set confirmation value');
assert.match(source, /DRY_RUN/, 'script must support dry-run mode');
assert.match(source, /\/api\/shopee-catalog\?action=get_full_catalog/, 'script must cover get_full_catalog');
assert.match(source, /SHOPEE_FULL_CATALOG_MAX_PAGES/, 'script must bound real full catalog reads by max pages');
assert.match(source, /SHOPEE_FULL_CATALOG_MAX_ITEMS/, 'script must bound real full catalog reads by max items');
assert.match(source, /sanitizeShopeeFullCatalogResponse/, 'script must sanitize full catalog responses');
assert.doesNotMatch(source, /update_stock|update_price|ship_order|add_item|delete_item|upload_image|upload_video/, 'script must not call mutations or media uploads');
assert.doesNotMatch(source, /access_token|refresh_token|partner_key|authorization|client_secret/i, 'script must not mention or print Shopee secrets');
assert.doesNotMatch(source, /console\.log\(.*item_list|console\.log\(.*response|console\.log\(.*body/i, 'script must not print raw full catalog bodies');

console.log('vps Shopee guarded full catalog checks static ok');
