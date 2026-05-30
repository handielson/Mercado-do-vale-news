import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/financial/FinancialPage.tsx', 'utf8');

const summaryStart = page.indexOf('function calcSummary');
assert.ok(summaryStart >= 0, 'FinancialPage must define calcSummary');
const summaryBody = page.slice(summaryStart, page.indexOf('function getDefaultRange', summaryStart));

assert.match(summaryBody, /const norm = normalizeSituacao\(c\.situacao\)/, 'summary must normalize Bling numeric situations');
assert.match(summaryBody, /if \(norm === 'pago'\) totalPago \+= c\.valor;/, 'summary must count numeric paid rows');
assert.match(summaryBody, /norm === 'em_aberto' \|\| norm === 'parcial'/, 'summary must count normalized open and partial rows');
assert.doesNotMatch(summaryBody, /c\.situacao === 'pago'/, 'summary must not depend on raw paid string only');

assert.match(page, /financialPreferencesService\.getFilters\(\)/, 'FinancialPage must restore saved filters from VPS');
assert.match(page, /financialPreferencesService\.saveFilters\(\{/, 'FinancialPage must persist filter changes to VPS');
assert.doesNotMatch(page, /localStorage\.(getItem|setItem)\(/, 'FinancialPage must not persist finance filters in browser localStorage');
assert.match(page, /tab,\s*dataInicio,\s*dataFim,\s*filtroSituacao,\s*searchTerm/s, 'FinancialPage must persist tab, dates, situation and text search');
assert.match(page, /if \(!filtersLoaded \|\| initialLoadDone\) return;/, 'FinancialPage must wait for VPS filters before the first Bling list load');
assert.match(page, /load\(false\);/, 'FinancialPage must automatically load Bling accounts after restoring VPS filters');

const preferencesService = readFileSync('services/financialPreferencesService.ts', 'utf8');
assert.match(preferencesService, /FINANCE_FILTERS_PREFERENCE_KEY = 'finance\.filters'/, 'financial filters must use a stable VPS preference key');
assert.match(preferencesService, /\/admin\/preferences\/\$\{encodeURIComponent\(FINANCE_FILTERS_PREFERENCE_KEY\)\}/, 'financial filters must use the VPS admin preferences endpoint');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS admin_preferences/, `${file} must create the admin preferences table`);
  assert.match(source, /fastify\.get\('\/admin\/preferences\/:key'/, `${file} must expose preference read endpoint`);
  assert.match(source, /fastify\.patch\('\/admin\/preferences\/:key'/, `${file} must expose preference write endpoint`);
  assert.match(source, /requireSyncKeyOrAdmin/, `${file} preference endpoint must be protected`);
}

console.log('financial summary and filters static checks ok');
