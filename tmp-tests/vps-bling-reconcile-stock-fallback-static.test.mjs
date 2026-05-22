import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function fetchAllBlingStocksForReconcileVps\(accessToken,\s*productIds = \[\]\)/,
    `${file} must allow reconcile stock fetches to receive mapped product IDs`,
  );
  assert.match(
    source,
    /idsProdutos\[\]=/,
    `${file} must use filtered Bling stock lookups by idsProdutos when needed`,
  );
  assert.match(
    source,
    /const localProducts = await fetchAllLocalProductsForReconcileVps\(\);[\s\S]*fetchAllBlingStocksForReconcileVps\(accessToken,\s*localProducts\.map\(/,
    `${file} must pass local mapped Bling IDs into reconcile stock fetching`,
  );
  assert.match(
    source,
    /new Set\(productIds[\s\S]*filter\(Boolean\)/,
    `${file} must deduplicate and sanitize mapped Bling IDs before fetching stock`,
  );
  assert.match(
    source,
    /for \(let i = 0; i < mappedIds\.length; i \+= 50\)/,
    `${file} must fetch mapped stock IDs in bounded chunks`,
  );
  assert.match(
    source,
    /await sleepBlingReconcileVps\(450\)/,
    `${file} must throttle filtered stock chunks below the Bling 3 req/s limit`,
  );
  assert.match(
    source,
    /response\.status === 429[\s\S]*await sleepBlingReconcileVps\(1200\)/,
    `${file} must retry stock chunks after Bling rate-limit responses`,
  );
  assert.match(
    source,
    /fetchAllBlingProductsForReconcileVps[\s\S]*await sleepBlingReconcileVps\(450\)[\s\S]*response\.status === 429/,
    `${file} must throttle and retry Bling product pages too`,
  );
  assert.match(
    source,
    /const remoteProducts = await fetchAllBlingProductsForReconcileVps\(accessToken\);[\s\S]*const remoteStocks = await fetchAllBlingStocksForReconcileVps/,
    `${file} must fetch products and stocks sequentially to respect the Bling global rate limit`,
  );
}

console.log('vps Bling reconcile stock fallback static checks ok');
