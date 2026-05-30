import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const guardPath = 'tools/audit-supabase-operational-dependencies.mjs';

assert.ok(
  existsSync(guardPath),
  'Supabase migration must have a static guard script for operational dependencies',
);

const source = readFileSync(guardPath, 'utf8');

assert.match(
  source,
  /MAX_BASELINE_FROM_CALLS\s*=\s*430/,
  'guard should pin the current .from(...) baseline so new operational dependencies fail review',
);

assert.match(
  source,
  /MAX_BASELINE_RPC_CALLS\s*=\s*29/,
  'guard should pin the reduced rpc(...) baseline so removed Supabase RPC dependencies do not return',
);

assert.match(
  source,
  /MAX_UNCLASSIFIED_OPERATIONAL_MATCHES\s*=\s*0/,
  'guard should fail when a new operational dependency is not classified by the temporary allowlist',
);

assert.match(
  source,
  /supabase\.storage|storage\\\.from/,
  'guard should scan Supabase Storage usage as part of the migration',
);

assert.match(
  source,
  /ALLOWED_OPERATIONAL_DEPENDENCIES\s*=\s*\[/,
  'guard should keep an explicit temporary allowlist for operational Supabase dependencies',
);

assert.doesNotMatch(
  source,
  /increment_banner_(?:clicks|views)/,
  'removed banner telemetry RPCs must not remain allowlisted',
);

assert.match(
  source,
  /authMatches/,
  'guard should report Supabase Auth separately from operational table dependencies',
);

assert.match(
  source,
  /allowedOperationalMatches/,
  'guard should separate allowlisted operational dependencies from unclassified dependencies',
);

for (const reason of [
  'orders-temporary',
  'warranty-temporary',
  'catalog-taxonomy-temporary',
  'customer-engagement-temporary',
  'admin-team-temporary',
  'storage-temporary',
  'customer-core-temporary',
  'product-variant-taxonomy-temporary',
  'shipping-config-temporary',
  'shopee-templates-temporary',
  'operations-observability-temporary',
  'cashback-rpc-temporary',
  'named-storage-buckets-temporary',
  'company-alias-temporary',
  'whatsapp-temporary',
  'customer-benefits-temporary',
  'inventory-rpc-temporary',
  'catalog-analytics-rpc-temporary',
  'app-versioning-temporary',
  'catalog-share-temporary',
  'dynamic-rpc-temporary',
  'catalog-analytics-tables-temporary',
  'inventory-audit-temporary',
  'legacy-users-table-temporary',
  'shopee-products-crossmodule-temporary',
]) {
  assert.match(
    source,
    new RegExp(reason),
    `guard allowlist should classify ${reason}`,
  );
}

assert.match(
  source,
  /process\.exitCode\s*=\s*1/,
  'guard should fail CI/terminal when the baseline grows',
);

console.log('supabase operational dependency guard static checks passed');
