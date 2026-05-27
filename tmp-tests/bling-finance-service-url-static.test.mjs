import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/blingFinanceService.ts', 'utf8');

assert.match(source, /const BASE = '\/api\/bling\?resource=finance';/);
assert.match(source, /function financeUrl\(params: URLSearchParams\): string \{/);
assert.match(source, /return `\$\{BASE\}&\$\{params\.toString\(\)\}`;/);
assert.doesNotMatch(source, /`\$\{BASE\}\?\$\{params\}`/);
assert.match(source, /blingFetch\(financeUrl\(params\)/);

console.log('bling finance service url static checks ok');
