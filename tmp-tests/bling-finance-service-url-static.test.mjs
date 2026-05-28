import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingFinanceService.ts', 'utf8');

assert.match(source, /const BASE = '\/api\/bling\?resource=finance';/);
assert.match(source, /function financeUrl\(params: URLSearchParams\): string \{/);
assert.match(source, /return `\$\{BASE\}&\$\{params\.toString\(\)\}`;/);
assert.doesNotMatch(source, /`\$\{BASE\}\?\$\{params\}`/);
assert.match(source, /blingFetch\(financeUrl\(params\)/);
assert.match(source, /const MAX_BLING_FINANCE_RANGE_DAYS = 366;/, 'finance searches must respect the Bling date range cap');
assert.match(source, /function splitFinanceDateRange\(filters\?: FinanceListFilters\): FinanceListFilters\[\]/, 'finance service must split long due-date ranges');
assert.match(source, /MAX_BLING_FINANCE_RANGE_DAYS - 1/, 'date chunks must be at most 366 inclusive days');
assert.match(source, /return fetchFinanceList<ContaPagar>\('pagar', filters, options\);/, 'pagar list must use the shared chunked fetcher');
assert.match(source, /return fetchFinanceList<ContaReceber>\('receber', filters, options\);/, 'receber list must use the shared chunked fetcher');

console.log('bling finance service url static checks ok');
