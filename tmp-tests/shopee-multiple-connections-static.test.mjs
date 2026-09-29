import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const connectionsService = readFileSync('services/shopeeConnections.ts', 'utf8');
const productsService = readFileSync('services/shopeeProducts.ts', 'utf8');
const ordersTab = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');
const financeTab = readFileSync('pages/admin/settings/components/ShopeeFinanceTab.tsx', 'utf8');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
    const server = readFileSync(serverFile, 'utf8');
    assert.match(server, /CREATE TABLE IF NOT EXISTS shopee_shop_connections/, `${serverFile} must create a separate store-connection table`);
    assert.match(server, /connection_id/, `${serverFile} OAuth and catalog requests must accept a connection id`);
    assert.match(server, /UPDATE shopee_shop_connections[\s\S]*shopee_access_token/, `${serverFile} token refresh must remain scoped to the selected connection`);
    assert.match(server, /fastify\.post\('\/shopee-connections'/, `${serverFile} must expose creation of a pending connection through the VPS proxy`);
}

assert.match(
    connectionsService,
    /vpsClient\.post[^\n]*\('\/shopee-connections'/,
    'Shopee connection writes must use a proxy-compatible path without the reserved /api prefix',
);
assert.doesNotMatch(
    connectionsService,
    /vpsClient\.(?:get|post)[^\n]*\('\/api\/shopee-connections'/,
    'Shopee connection service must not send a nested /api path through /api/vps-proxy',
);
assert.match(page, /Lojas Shopee adicionais/, 'admin page must expose additional stores');
assert.match(page, /connection_id=\$\{encodeURIComponent\(connection\.id\)\}/, 'OAuth must target the selected additional store');
assert.match(
    page,
    /connection\.authorization_status === 'connected'[\s\S]*?>\s*Conectada\s*<\/span>/,
    'connected additional stores must show a visible connected badge',
);
assert.match(page, /selectedConnectionId/, 'admin page must keep an explicit selected Shopee store');
assert.match(page, /Loja Shopee em uso/, 'admin page must expose the operational store selector');
assert.match(page, /normalizeShopeeConnectionId\(row\.connection_id\) === selectedConnectionId/, 'product links must be filtered by selected store');
assert.match(page, /selectedConnectionId === PRIMARY_SHOPEE_CONNECTION_ID[\s\S]*?normalizePositiveId\(p\.shopee_item_id\)/, 'legacy primary item ids must never appear as Glaucia links');
assert.match(page, /connection_id:\s*selectedConnectionId/, 'manual and imported links must persist the selected store');
assert.match(page, /connectionId=\{selectedConnectionId\}/, 'publish, orders and finance flows must receive the selected store');
assert.match(productsService, /idx|connection_id|normalizeConnectionId/, 'product link service must scope operations by connection id');
assert.match(ordersTab, /shopee_orders_\$\{connectionId\}_\$\{statusFilter\}/, 'order cache must be isolated by store');
assert.match(ordersTab, /connection_id:\s*connectionId/, 'order mutations must target the selected store');
assert.match(financeTab, /financeCacheKey\(connectionId\)/, 'finance cache must be isolated by store');
assert.match(financeTab, /withShopeeConnection[\s\S]*connectionId/, 'finance reads must target the selected store');

console.log('shopee multiple connections static checks ok');
