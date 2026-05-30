import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['services', 'pages', 'components', 'hooks', 'contexts', 'utils'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs']);
const MAX_BASELINE_FROM_CALLS = 430;
const MAX_BASELINE_RPC_CALLS = 29;
const MAX_BASELINE_STORAGE_CALLS = 13;
const MAX_UNCLASSIFIED_OPERATIONAL_MATCHES = 0;

const ALLOWED_OPERATIONAL_DEPENDENCIES = [
  {
    reason: 'auth-and-profile-temporary',
    targets: ['profiles', 'user_permissions', 'companies'],
    files: ['services/', 'contexts/', 'hooks/', 'pages/'],
  },
  {
    reason: 'company-alias-temporary',
    targets: ['company'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'products-catalog-migration-temporary',
    targets: [
      'products',
      'models',
      'brands',
      'categories',
      'custom_fields',
      'model_color_images',
      'product_categories',
      'product_price_history',
      'shopee_products',
    ],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'sales-customers-finance-temporary',
    targets: ['sales', 'sale_items', 'customers', 'cashback_transactions', 'receivables', 'payables', 'payment_methods'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'customer-core-temporary',
    targets: ['customers'],
    files: ['utils/', 'contexts/', 'hooks/'],
  },
  {
    reason: 'orders-temporary',
    targets: ['orders', 'order_items', 'order_status_history'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'admin-config-temporary',
    targets: ['company_settings', 'catalog_settings', 'catalog_banners', 'system_tags', 'telegram_settings'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'whatsapp-temporary',
    targets: ['whatsapp_settings'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'catalog-taxonomy-temporary',
    targets: [
      'colors',
      'cross_sell_tags',
      'catalog_sections',
      'model_eans',
      'model_variant_images',
      'battery_healths',
      'product_reviews',
    ],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'product-variant-taxonomy-temporary',
    targets: ['model_variants', 'rams', 'storages', 'category_display_config'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'warranty-temporary',
    targets: ['warranty_templates', 'warranty_documents'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'customer-engagement-temporary',
    targets: [
      'customer_type_requests',
      'instagram_schedule',
      'coin_transactions',
      'coin_promotions',
      'checkin_logs',
    ],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'customer-benefits-temporary',
    targets: ['cashback_settings', 'customer_benefits'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'admin-team-temporary',
    targets: ['team_members', 'company_documents'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'inventory-and-operations-temporary',
    targets: [
      'stock_movements',
      'stock_locations',
      'stock_deposits',
      'product_units',
      'shipping_settings',
      'product_stock_locations',
      'stock_location_movements',
      'units',
    ],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'inventory-rpc-temporary',
    targets: [
      'decrement_stock',
      'increment_stock',
      'add_product_stock_location',
      'adjust_product_stock_location',
      'consume_order_stock_reservations',
      'decrement_product_stock_by_priority',
      'release_order_stock_reservations',
      'reserve_product_stock_by_priority',
      'restore_product_stock_from_order_movements',
      'restore_product_stock_from_sale_movements',
      'transfer_product_stock_location',
    ],
    kinds: ['rpc'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'shipping-config-temporary',
    targets: ['delivery_credits', 'shipping_price_ranges', 'shipping_zones'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'integration-settings-temporary',
    targets: ['bling_settings', 'shopee_settings', 'mercadopago_settings', 'google_contacts_settings', 'payment_integrations'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'shopee-templates-temporary',
    targets: ['shopee_templates'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'operations-observability-temporary',
    targets: ['system_logs', 'performance_metrics', 'unit_swap_logs', 'versions'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'app-versioning-temporary',
    targets: ['versions'],
    files: ['utils/', 'contexts/', 'hooks/'],
  },
  {
    reason: 'cashback-rpc-temporary',
    targets: [
      'add_coins',
      'process_referral_reward',
      'add_pending_coins',
      'confirm_pending_coins',
      'cancel_pending_coins',
      'spend_coins',
      'refund_coins',
      'refund_referral_coins',
      'coin_balances',
      'benefit_redemptions',
      'promotions',
    ],
    kinds: ['from', 'rpc'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'catalog-analytics-rpc-temporary',
    targets: ['increment_coin_promo_uses', 'increment_product_views'],
    kinds: ['rpc'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'catalog-analytics-tables-temporary',
    targets: ['product_views'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'catalog-share-temporary',
    targets: ['catalog_shares'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'inventory-audit-temporary',
    targets: ['stock_location_divergences'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'legacy-users-table-temporary',
    targets: ['users'],
    files: ['services/', 'components/', 'pages/', 'contexts/', 'hooks/'],
  },
  {
    reason: 'shopee-products-crossmodule-temporary',
    targets: ['shopee_products'],
    files: ['contexts/', 'hooks/'],
  },
  {
    reason: 'dynamic-rpc-temporary',
    targets: ['rpc'],
    kinds: ['rpc'],
    files: ['services/', 'components/', 'pages/'],
  },
  {
    reason: 'named-storage-buckets-temporary',
    targets: ['product-images', 'customer-avatars'],
    kinds: ['from', 'storage'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
  {
    reason: 'storage-temporary',
    targets: ['dynamic'],
    kinds: ['storage'],
    files: ['services/', 'components/', 'pages/', 'utils/'],
  },
];

function walk(dir, files = []) {
  const absoluteDir = path.join(ROOT, dir);
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path.relative(ROOT, absolutePath).replace(/\\/g, '/');
    if (relativePath.includes('/node_modules/') || relativePath.startsWith('dist/')) continue;

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walk(relativePath, files);
      continue;
    }

    if (stat.isFile() && EXTENSIONS.has(path.extname(entry))) {
      files.push(relativePath);
    }
  }
  return files;
}

function collectMatches(files, regex, kind) {
  const matches = [];
  for (const file of files) {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      matches.push({
        kind,
        file,
        line,
        target: match[1] || match[2] || match[3] || 'dynamic',
      });
    }
  }
  return matches;
}

function summarizeByTarget(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.target, (counts.get(match.target) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target));
}

function uniqueFiles(matches) {
  return new Set(matches.map((match) => match.file)).size;
}

function isAllowedOperationalMatch(match) {
  return ALLOWED_OPERATIONAL_DEPENDENCIES.some((entry) => {
    const targetAllowed = entry.targets.includes(match.target) || entry.targets.includes('*');
    const kindAllowed = !entry.kinds || entry.kinds.includes(match.kind);
    const fileAllowed = entry.files.some((prefix) => match.file.startsWith(prefix));
    return targetAllowed && kindAllowed && fileAllowed;
  });
}

function annotateAllowedMatches(matches) {
  return matches
    .map((match) => {
      const allowedBy = ALLOWED_OPERATIONAL_DEPENDENCIES.find((entry) => {
        const targetAllowed = entry.targets.includes(match.target) || entry.targets.includes('*');
        const kindAllowed = !entry.kinds || entry.kinds.includes(match.kind);
        const fileAllowed = entry.files.some((prefix) => match.file.startsWith(prefix));
        return targetAllowed && kindAllowed && fileAllowed;
      });
      return allowedBy ? { ...match, allowedBy: allowedBy.reason } : null;
    })
    .filter(Boolean);
}

function summarizeByReason(matches) {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.allowedBy, (counts.get(match.allowedBy) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

const files = SCAN_DIRS.flatMap((dir) => walk(dir));
const fromMatches = collectMatches(files, /\.from\('([^']+)'\)|supabase\.from\('([^']+)'\)/g, 'from');
const rpcMatches = collectMatches(files, /supabase\.rpc\(\s*'([^']+)'|\.rpc\(\s*'([^']+)'|\.rpc\(\s*([A-Za-z_$][\w$]*)/g, 'rpc');
const storageMatches = collectMatches(files, /supabase\.storage|storage\.from\('([^']+)'\)/g, 'storage');
const authMatches = collectMatches(files, /supabase\.auth\.([A-Za-z_$][\w$]*)/g, 'auth');
const operationalMatches = [...fromMatches, ...rpcMatches, ...storageMatches];
const allowedOperationalMatches = annotateAllowedMatches(operationalMatches);
const unclassifiedOperationalMatches = operationalMatches.filter((match) => !isAllowedOperationalMatch(match));

const report = {
  scannedFiles: files.length,
  baselines: {
    from: MAX_BASELINE_FROM_CALLS,
    rpc: MAX_BASELINE_RPC_CALLS,
    storage: MAX_BASELINE_STORAGE_CALLS,
  },
  totals: {
    from: fromMatches.length,
    rpc: rpcMatches.length,
    storage: storageMatches.length,
  },
  files: {
    from: uniqueFiles(fromMatches),
    rpc: uniqueFiles(rpcMatches),
    storage: uniqueFiles(storageMatches),
    auth: uniqueFiles(authMatches),
  },
  auth: {
    total: authMatches.length,
    topMethods: summarizeByTarget(authMatches).slice(0, 20),
  },
  allowlist: {
    entries: ALLOWED_OPERATIONAL_DEPENDENCIES.map((entry) => ({
      reason: entry.reason,
      targets: entry.targets,
      kinds: entry.kinds || ['from', 'rpc', 'storage'],
      files: entry.files,
    })),
    allowedOperationalMatches: allowedOperationalMatches.length,
    unclassifiedOperationalMatches: unclassifiedOperationalMatches.length,
    byReason: summarizeByReason(allowedOperationalMatches),
    topUnclassifiedTargets: summarizeByTarget(unclassifiedOperationalMatches).slice(0, 20),
  },
  topFromTargets: summarizeByTarget(fromMatches).slice(0, 20),
  topRpcTargets: summarizeByTarget(rpcMatches).slice(0, 30),
  topStorageTargets: summarizeByTarget(storageMatches).slice(0, 20),
};

const violations = [];
if (report.totals.from > MAX_BASELINE_FROM_CALLS) {
  violations.push(`Supabase .from(...) calls increased: ${report.totals.from} > ${MAX_BASELINE_FROM_CALLS}`);
}
if (report.totals.rpc > MAX_BASELINE_RPC_CALLS) {
  violations.push(`Supabase rpc(...) calls increased: ${report.totals.rpc} > ${MAX_BASELINE_RPC_CALLS}`);
}
if (report.totals.storage > MAX_BASELINE_STORAGE_CALLS) {
  violations.push(`Supabase storage calls increased: ${report.totals.storage} > ${MAX_BASELINE_STORAGE_CALLS}`);
}
if (report.allowlist.unclassifiedOperationalMatches > MAX_UNCLASSIFIED_OPERATIONAL_MATCHES) {
  violations.push(
    `Unclassified Supabase operational dependencies increased: ${report.allowlist.unclassifiedOperationalMatches} > ${MAX_UNCLASSIFIED_OPERATIONAL_MATCHES}`,
  );
}

console.log(JSON.stringify({ ...report, ok: violations.length === 0, violations }, null, 2));

if (violations.length > 0) {
  process.exitCode = 1;
}
