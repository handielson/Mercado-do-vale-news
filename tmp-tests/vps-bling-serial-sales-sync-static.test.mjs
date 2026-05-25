import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /resource === 'serial-sales-sync'/, `${file} must expose a manual Bling serial sale sync resource`);
  assert.match(source, /syncBlingSerialSalesFromRecentOrdersVps/, `${file} must implement recent Bling order serial sync`);
  assert.match(source, /\/Api\/v3\/pedidos\/vendas\?pagina=/, `${file} must read recent Bling sales orders`);
  assert.match(source, /\/Api\/v3\/pedidos\/vendas\/\$\{encodeURIComponent/, `${file} must read Bling sale details`);
  assert.match(source, /extractBlingSerialSaleImeisVps[\s\S]*\\b\\d\{15\}\\b/, `${file} must extract only 15-digit IMEI values from observations`);
  assert.match(source, /detail\?\.observacoes[\s\S]*detail\?\.observacoesInternas/, `${file} must read IMEIs from order observations`);
  assert.match(source, /SELECT u\.id, u\.product_id, u\.imei_1, u\.status, p\.sku AS product_sku/, `${file} must resolve IMEIs through units joined to products`);
  assert.match(source, /unit_sku_not_in_order/, `${file} must reject IMEIs whose unit SKU is not present in the Bling order`);
  assert.match(source, /sku_quantity_exceeded/, `${file} must reject extra IMEIs beyond the sold item quantity`);
  assert.match(source, /unit\.status !== 'available'/, `${file} must avoid mutating unavailable/sold units`);
  assert.match(source, /UPDATE units[\s\S]*status = 'sold'[\s\S]*sold_at = COALESCE/, `${file} must mark matched units as sold`);
  assert.match(source, /await syncProductStock\(unit\.product_id\)/, `${file} must recalculate VPS product stock from available units`);
  assert.match(source, /supabaseRestPatch\('products'[\s\S]*stock_quantity: productStock/, `${file} must mirror serialized stock back to Supabase`);
  assert.match(source, /const serialSales = await syncBlingSerialSalesFromRecentOrdersVps/, `${file} must run serial sale sync as part of reconcile`);
  assert.match(source, /serial-sales-sync\|finance/, `${file} must advertise the migrated serial-sales-sync resource`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-serial-sales-sync',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped debug payloads for serial sale sync failures`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|syncKey|x-sync-key|apikey)\b/i, `${file} must not expose secrets in serial sale sync debug payloads`);
  }
}

console.log('vps Bling serial sales sync static checks ok');
