import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/financial/FinancialPage.tsx', 'utf8');
const service = readFileSync('services/blingFinanceService.ts', 'utf8');

const loadStart = page.indexOf('const load = useCallback');
assert.ok(loadStart >= 0, 'FinancialPage must have the load callback');
const loadBody = page.slice(loadStart, page.indexOf('async function handleBaixar', loadStart));

assert.doesNotMatch(loadBody, /localStorage\.(getItem|setItem)\(/, 'FinancialPage must not cache Bling finance payloads in browser storage');
assert.match(loadBody, /listContasPagar\(filters, \{ forceRefresh \}\)/, 'pagar list must forward manual refresh to the VPS cache');
assert.match(loadBody, /listContasReceber\(filters, \{ forceRefresh \}\)/, 'receber list must forward manual refresh to the VPS cache');
assert.doesNotMatch(page, /bling_finance_\$\{dataInicio\}/, 'old browser finance cache key must be removed');

assert.match(service, /type FinanceListOptions = \{\s*forceRefresh\?: boolean;\s*\};/, 'finance service must expose cache refresh options');
assert.match(service, /if \(options\?\.forceRefresh\) params\.set\('forceRefresh', '1'\);/, 'finance service must send explicit refresh requests to VPS');

console.log('bling finance no browser cache static checks ok');
