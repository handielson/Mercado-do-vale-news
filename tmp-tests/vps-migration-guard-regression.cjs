const { spawnSync } = require('node:child_process');

const checks = [
  { name: 'bling_stock_sync_static', file: 'tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'bling_stock_sync_default', file: 'tmp-tests/vps-bling-stock-sync-guarded-check.cjs', mode: 'guard' },
  { name: 'bling_product_update_static', file: 'tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'bling_product_update_default', file: 'tmp-tests/vps-bling-product-update-guarded-check.cjs', mode: 'guard' },
  { name: 'bling_finance_mutation_static', file: 'tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'bling_finance_mutation_default', file: 'tmp-tests/vps-bling-finance-mutation-guarded-check.cjs', mode: 'guard' },
  { name: 'shopee_stock_price_static', file: 'tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'shopee_stock_price_default', file: 'tmp-tests/vps-shopee-mutation-guarded-check.cjs', mode: 'guard' },
  { name: 'shopee_ship_order_static', file: 'tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'shopee_ship_order_default', file: 'tmp-tests/vps-shopee-ship-order-guarded-check.cjs', mode: 'guard' },
  { name: 'shopee_add_item_media_static', file: 'tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs', mode: 'static' },
  { name: 'shopee_add_item_media_default', file: 'tmp-tests/vps-shopee-add-item-media-guarded-check.cjs', mode: 'guard' },
  { name: 'bling_webhook_static', file: 'tmp-tests/vps-bling-webhook-simulation-static.test.mjs', mode: 'static' },
  { name: 'bling_webhook_default', file: 'tmp-tests/vps-bling-webhook-simulation.cjs', mode: 'guard' },
  { name: 'shopee_webhook_static', file: 'tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs', mode: 'static' },
  { name: 'shopee_webhook_default', file: 'tmp-tests/vps-shopee-webhook-order-simulation.cjs', mode: 'guard' },
  { name: 'mercadopago_webhook_static', file: 'tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs', mode: 'static' },
  { name: 'mercadopago_webhook_default', file: 'tmp-tests/vps-mercadopago-webhook-simulation.cjs', mode: 'guard' },
  { name: 'shipping_quote_static', file: 'tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs', mode: 'static' },
  { name: 'shipping_quote_default', file: 'tmp-tests/vps-shipping-quote-guarded-simulation.cjs', mode: 'guard' },
  { name: 'melhor_envio_label_static', file: 'tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs', mode: 'static' },
  { name: 'melhor_envio_label_default', file: 'tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs', mode: 'guard' },
  { name: 'oauth_preflight_static', file: 'tmp-tests/vps-oauth-preflight-check-static.test.mjs', mode: 'static' },
  { name: 'oauth_preflight_default', file: 'tmp-tests/vps-oauth-preflight-check.cjs', mode: 'guard' },
  { name: 'seo_production_host_static', file: 'tmp-tests/vps-seo-production-host-check-static.test.mjs', mode: 'static' },
  { name: 'seo_production_host_default', file: 'tmp-tests/vps-seo-production-host-check.cjs', mode: 'guard' },
  { name: 'nginx_production_install_static', file: 'tmp-tests/vps-nginx-production-config-install-static.test.mjs', mode: 'static' },
  { name: 'nginx_production_install_default', file: 'tmp-tests/vps-nginx-production-config-install.cjs', mode: 'guard' },
];

const unsafeMarkers = [
  ['mutation_executed', true],
  ['full_catalog_executed', true],
  ['quote_sent', true],
  ['label_requested', true],
  ['webhook_sent', true],
  ['live_read', true],
  ['install_executed', true],
];

function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasUnsafeMarker(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return unsafeMarkers.some(([key, value]) => payload[key] === value);
}

function runCheck(check) {
  const child = spawnSync(process.execPath, [check.file], {
    encoding: 'utf8',
    env: { ...process.env },
    shell: false,
  });
  const payload = parseJsonOutput(child.stdout);
  const unsafe = check.mode === 'guard' && hasUnsafeMarker(payload);

  return {
    name: check.name,
    file: check.file,
    status: child.status,
    ok: child.status === 0 && !unsafe,
    mode: check.mode,
    unsafe,
    reason: payload?.results?.[0]?.reason || payload?.reason || null,
    stdout_tail: child.stdout ? child.stdout.trim().split(/\r?\n/).slice(-1)[0].slice(0, 180) : '',
    stderr_tail: child.stderr ? child.stderr.trim().split(/\r?\n/).slice(-1)[0].slice(0, 180) : '',
  };
}

const results = checks.map(runCheck);
const failed = results.filter((result) => !result.ok);

console.log(JSON.stringify({
  ok: failed.length === 0,
  mutation_executed: false,
  checked: results.length,
  failed: failed.length,
  results,
}, null, 2));

if (failed.length) process.exit(1);
