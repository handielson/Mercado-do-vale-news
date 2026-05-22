import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'sync-prices-vps'/, `${file} must route Bling sync-prices-vps through Fastify`);
  assert.match(source, /const pageSize = 50/, `${file} must keep sync-prices-vps page size`);
  assert.match(source, /VPS_SYNC_KEY[\s\S]*VITE_VPS_SYNC_KEY[\s\S]*SYNC_SECRET/, `${file} must resolve compatible VPS sync key env names`);
  assert.match(source, /isLocalVpsBatchHost\(/, `${file} must detect local batch host calls`);
  assert.match(source, /isLocalVpsBatchHost\(host\) \? 'http' : 'https'/, `${file} must use http for local self-calls`);
  assert.match(source, /VPS_SYNC_KEY not configured/, `${file} must fail clearly when sync key is missing`);
  assert.match(source, /select=id,name,sku,status,category_id,price_retail,price_reseller,price_wholesale,price_cost,stock_quantity,track_inventory,bling_id,bling_parent_id,parent_id/, `${file} must load price, stock, and Bling linkage fields from Supabase`);
  assert.doesNotMatch(source, /select=.*is_combo/, `${file} must not query the removed Supabase products.is_combo column`);
  assert.match(source, /Range:\s*`\$\{from\}-\$\{to\}`/, `${file} must page Supabase products with a numeric range header`);
  assert.match(source, /'Range-Unit':\s*'items'/, `${file} must set the PostgREST range unit separately`);
  assert.match(source, /Prefer:\s*'count=exact'/, `${file} must request exact Supabase count`);
  assert.match(source, /bling_id:\s*p\.bling_id \?\? null[\s\S]*bling_parent_id:\s*p\.bling_parent_id \?\? null[\s\S]*parent_id:\s*p\.parent_id \?\? null/, `${file} must preserve Bling linkage fields in VPS payload`);
  assert.match(source, /\/products\/batch/, `${file} must sync into the VPS products batch endpoint`);
  assert.match(source, /'X-Sync-Key': syncKey/, `${file} must authenticate products batch sync`);
  assert.match(source, /hasMore[\s\S]*nextPage/, `${file} must return pagination metadata`);
  assert.match(source, /buildCopyableDebug\('bling-sync-prices-vps'/, `${file} must return copyable debug details for sync failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-sync-prices-vps',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped sync-prices debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(syncKey|x-sync-key|authorization|service_role|apikey)\b/i, `${file} must not expose sync keys in sync-prices debug payloads`);
  }
}

console.log('vps Bling sync-prices-vps Fastify static checks ok');
