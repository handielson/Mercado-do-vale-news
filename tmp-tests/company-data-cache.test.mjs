import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../services/companyService.ts', import.meta.url), 'utf8');

assert.match(
  source,
  /let\s+companyDataPromise\s*:\s*Promise<Company>\s*\|\s*null\s*=\s*null/,
  'companyService must keep an in-flight getCompanyData promise to deduplicate boot-time callers',
);

assert.match(
  source,
  /companyDataPromise\s*=\s*loadCompanyData\(\)/,
  'getCompanyData must populate the shared in-flight promise from the uncached loader',
);

assert.match(
  source,
  /companyDataPromise\s*=\s*null/,
  'companyService must invalidate the cached promise after mutations',
);

