import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
    const server = readFileSync(serverFile, 'utf8');
    assert.match(server, /CREATE TABLE IF NOT EXISTS shopee_shop_connections/, `${serverFile} must create a separate store-connection table`);
    assert.match(server, /connection_id/, `${serverFile} OAuth and catalog requests must accept a connection id`);
    assert.match(server, /UPDATE shopee_shop_connections[\s\S]*shopee_access_token/, `${serverFile} token refresh must remain scoped to the selected connection`);
    assert.match(server, /fastify\.post\('\/api\/shopee-connections'/, `${serverFile} must expose creation of a pending connection`);
}
assert.match(page, /Lojas Shopee adicionais/, 'admin page must expose additional stores');
assert.match(page, /connection_id=\$\{encodeURIComponent\(connection\.id\)\}/, 'OAuth must target the selected additional store');

console.log('shopee multiple connections static checks ok');
