import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'reconcile'/, `${file} must route Bling reconcile through Fastify`);
  assert.match(source, /isBlingReconcileAuthorizedVps\(/, `${file} must authorize reconcile calls`);
  assert.match(source, /CRON_SECRET/, `${file} must accept CRON_SECRET authorization for reconcile`);
  assert.match(source, /VPS_SYNC_KEY[\s\S]*VITE_VPS_SYNC_KEY[\s\S]*SYNC_SECRET/, `${file} must keep compatible sync key authorization`);
  assert.match(source, /getValidBlingAccessTokenForReconcileVps\(/, `${file} must load or refresh the stored Bling token for reconcile`);
  assert.match(source, /fetchAllLocalProductsForReconcileVps\(/, `${file} must fetch local mapped products for reconcile`);
  assert.match(source, /FROM products WHERE bling_id IS NOT NULL/, `${file} must fetch mapped local products from VPS MySQL, the migration source of truth`);
  assert.doesNotMatch(source, /select=id,sku,name,stock_quantity,bling_id&bling_id=not\.is\.null/, `${file} must not build reconcile plans from stale Supabase product rows`);
  assert.match(source, /fetchAllBlingProductsForReconcileVps\(/, `${file} must fetch all Bling products for reconcile`);
  assert.match(source, /fetchAllBlingStocksForReconcileVps\(/, `${file} must fetch all Bling stock balances for reconcile`);
  assert.match(source, /buildBlingReconcilePlanVps\(/, `${file} must build a reconcile plan on the VPS`);
  assert.match(source, /dryRun[\s\S]*planned[\s\S]*stockChanges[\s\S]*nameChanges/, `${file} must support dry-run reconcile planning`);
  assert.match(source, /applyReconcileStockChangesVps\(/, `${file} must apply stock changes when dryRun is false`);
  assert.match(source, /applyReconcileNameChangesVps\(/, `${file} must apply name changes when dryRun is false`);
  assert.match(source, /patchVpsForReconcileVps\('\/products\/stock'/, `${file} must keep syncing reconcile stock changes to VPS endpoints`);
  assert.match(source, /patchVpsForReconcileVps\('\/products\/name'/, `${file} must keep syncing reconcile name changes to VPS endpoints`);
  assert.match(source, /buildCopyableDebug\('bling-reconcile'/, `${file} must return copyable debug details for reconcile failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-reconcile',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped reconcile debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|syncKey|x-sync-key|apikey)\b/i, `${file} must not expose secrets in reconcile debug payloads`);
  }
}

console.log('vps Bling reconcile Fastify static checks ok');
