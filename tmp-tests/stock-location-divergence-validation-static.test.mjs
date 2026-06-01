import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/20260509000001_multi_deposit_stock.sql');
const service = read('services/stockLocationService.ts');
const page = read('pages/admin/inventory/StockLocationsPage.tsx');

assert.match(
  migration,
  /CREATE OR REPLACE VIEW stock_location_divergences AS[\s\S]*COALESCE\(p\.stock_quantity,\s*0\) AS product_stock_quantity[\s\S]*COALESCE\(SUM\(psl\.quantity\),\s*0\)::INTEGER AS location_stock_quantity[\s\S]*AS difference/,
  'migration must expose a divergence view comparing product total stock with local stock sum'
);

assert.match(
  migration,
  /LEFT JOIN product_stock_locations psl ON psl\.product_id = p\.id/,
  'divergence view must compare products even when no local stock row exists'
);

assert.match(
  service,
  /vpsClient\.get<StockLocationDivergence\[]>\('\/stock-locations\/divergences'\)/,
  'service must load non-zero divergence rows from the VPS endpoint'
);

assert.doesNotMatch(
  service,
  /from\(['"]stock_location_divergences['"]\)/,
  'service must not query the Supabase divergence view directly'
);

assert.match(page, /getStockDivergences\(\)/, 'admin stock locations page must load divergence data');
assert.match(page, /product_stock_quantity/, 'admin page must show the current total stock value');
assert.match(page, /location_stock_quantity/, 'admin page must show the local stock sum');
assert.match(page, /difference/, 'admin page must show the divergence amount');
assert.match(page, /Nenhuma diverg/, 'admin page must show an empty divergence state');

console.log('stock location divergence validation static checks passed');
