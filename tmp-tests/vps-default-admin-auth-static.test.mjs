import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.cjs', 'utf8');

assert.match(server, /async function ensureDefaultAdminAccount\(/, 'VPS server must ensure an admin account exists for panel access');
assert.match(server, /MDV_ADMIN_EMAIL|ADMIN_EMAIL|VPS_ADMIN_EMAIL/, 'admin bootstrap should read an admin email from env aliases');
assert.match(server, /MDV_ADMIN_PASSWORD|ADMIN_PASSWORD|VPS_ADMIN_PASSWORD/, 'admin bootstrap should read an admin password from env aliases');
assert.match(server, /customer_type\s*=\s*'ADMIN'|customer_type, is_active, account_status/, 'admin bootstrap must create or promote the customer as ADMIN');
assert.match(server, /INSERT INTO customer_auth[\s\S]*ON DUPLICATE KEY UPDATE/, 'admin bootstrap must register credentials in customer_auth idempotently');
assert.match(server, /await ensureDefaultAdminAccount\(\);/, 'startup migrations must run the admin auth bootstrap');

console.log('VPS default admin auth static checks passed');
