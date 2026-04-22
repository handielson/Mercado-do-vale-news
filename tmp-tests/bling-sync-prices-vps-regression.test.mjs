import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blingApiPath = path.resolve(__dirname, '../api/bling.ts');
const blingApiSource = readFileSync(blingApiPath, 'utf8');

assert.match(
  blingApiSource,
  /select\('id,\s*name,\s*sku,\s*status,\s*category_id,\s*price_retail,\s*price_reseller,\s*price_wholesale,\s*price_cost,\s*stock_quantity,\s*track_inventory,\s*is_combo,\s*bling_id,\s*bling_parent_id,\s*parent_id'/m,
  'sync-prices-vps must load the Bling linkage fields from Supabase so the VPS batch sync does not drop them',
);

assert.match(
  blingApiSource,
  /bling_id:\s*p\.bling_id\s*\?\?\s*null,\s*[\s\S]*?bling_parent_id:\s*p\.bling_parent_id\s*\?\?\s*null,\s*[\s\S]*?parent_id:\s*p\.parent_id\s*\?\?\s*null,/m,
  'sync-prices-vps must keep bling_id/bling_parent_id/parent_id in the VPS payload to preserve webhook lookups',
);

console.log('bling-sync-prices-vps regression guard ok');
