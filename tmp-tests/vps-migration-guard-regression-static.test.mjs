import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-migration-guard-regression.cjs', 'utf8');

assert.match(source, /vps-bling-stock-sync-guarded-check\.cjs/, 'runner must cover Bling stock-sync guard');
assert.match(source, /vps-bling-product-update-guarded-check\.cjs/, 'runner must cover Bling product update guard');
assert.match(source, /vps-bling-finance-mutation-guarded-check\.cjs/, 'runner must cover Bling finance mutation guard');
assert.match(source, /vps-shopee-mutation-guarded-check\.cjs/, 'runner must cover Shopee stock/price guard');
assert.match(source, /vps-shopee-ship-order-guarded-check\.cjs/, 'runner must cover Shopee ship_order guard');
assert.match(source, /vps-shopee-add-item-media-guarded-check\.cjs/, 'runner must cover Shopee add_item/media guard');
assert.match(source, /vps-bling-webhook-simulation\.cjs/, 'runner must cover Bling webhook simulation guard');
assert.match(source, /vps-shopee-webhook-order-simulation\.cjs/, 'runner must cover Shopee webhook simulation guard');
assert.match(source, /vps-mercadopago-webhook-simulation\.cjs/, 'runner must cover Mercado Pago webhook simulation guard');
assert.match(source, /vps-shipping-quote-guarded-simulation\.cjs/, 'runner must cover shipping quote guard');
assert.match(source, /vps-melhor-envio-label-guarded-simulation\.cjs/, 'runner must cover Melhor Envio label guard');
assert.match(source, /vps-oauth-preflight-check\.cjs/, 'runner must cover OAuth preflight guard');
assert.match(source, /vps-external-cutover-read-only-check\.cjs/, 'runner must cover external cutover read-only route guard');
assert.match(source, /vps-seo-production-host-check\.cjs/, 'runner must cover SEO production host guard');
assert.match(source, /spawnSync\(process\.execPath/, 'runner must execute guards through Node without shell interpolation');
assert.match(source, /mutation_executed/, 'runner must inspect mutation execution markers');
assert.match(source, /full_catalog_executed|quote_sent|label_requested|webhook_sent|live_read|route_probe_sent|install_executed/, 'runner must inspect non-mutation guard markers');
assert.doesNotMatch(source, /DRY_RUN['"]?\s*:\s*['"]false|CONFIRM_.*I_UNDERSTAND/, 'runner must not set apply confirmations or disable dry-run');
assert.doesNotMatch(source, /access_token|refresh_token|client_secret|partner_key|Authorization|CRON_SECRET|SYNC_SECRET|VPS_SYNC_KEY/i, 'runner must not mention or print secrets');

console.log('vps migration guard regression static checks ok');
