import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/paymentIntegrationService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'payment integration service must not use Supabase directly');
assert.match(source, /vpsClient/, 'payment integration service must use vpsClient');
assert.match(source, /getCompanyId.*companyContext|companyContext.*getCompanyId/s, 'payment integration service must use the shared company context');
assert.match(source, /\/table-data\/payment_integrations/, 'payment integrations must use the VPS table-data endpoint');
assert.match(source, /\.patch<|vpsClient\.patch/, 'payment integration updates must use VPS PATCH');
assert.match(source, /\.post<|vpsClient\.post/, 'payment integration inserts must use VPS POST');
assert.match(source, /vpsClient\.delete/, 'payment integration deletes must use VPS DELETE');

console.log('payment integration VPS static checks passed');
