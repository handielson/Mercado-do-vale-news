import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/paymentIntegrationService.ts', 'utf8');
const vpsServers = [
  readFileSync('vps_server.js', 'utf8'),
  readFileSync('vps_server.cjs', 'utf8'),
];

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'payment integration service must not use Supabase directly');
assert.match(source, /vpsClient/, 'payment integration service must use vpsClient');
assert.match(source, /getCompanyId.*companyContext|companyContext.*getCompanyId/s, 'payment integration service must use the shared company context');
assert.match(source, /\/table-data\/payment_integrations/, 'payment integrations must use the VPS table-data endpoint');
assert.match(source, /\.patch<|vpsClient\.patch/, 'payment integration updates must use VPS PATCH');
assert.match(source, /\.post<|vpsClient\.post/, 'payment integration inserts must use VPS POST');
assert.match(source, /vpsClient\.delete/, 'payment integration deletes must use VPS DELETE');

for (const vpsSource of vpsServers) {
  assert.match(vpsSource, /addColumnIfMissing\('payment_integrations', 'company_id', 'CHAR\(36\) NULL'\)/, 'VPS migration must add company_id so the checkout can load existing payment integrations');
  assert.match(vpsSource, /UPDATE payment_integrations SET company_id = \? WHERE company_id IS NULL OR TRIM\(company_id\) = ''/, 'VPS migration must associate legacy payment integrations with the default company');
}

console.log('payment integration VPS static checks passed');
