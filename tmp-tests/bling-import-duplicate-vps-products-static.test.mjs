import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('services/blingService.ts'), 'utf8');

const start = source.indexOf('export async function importBlingProducts');
const end = source.indexOf('if (vpsRows.length > 0)', start);
assert(start >= 0 && end > start, 'Could not isolate Bling selected import flow');

const block = source.slice(start, end);

assert(
  /existingVpsProducts\s*=\s*\(await vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'Bling import should preload existing products from VPS for duplicate checks',
);

assert(
  /existingVpsProducts\.find\(\(product: any\)[\s\S]*Number\(product\.bling_id\)[\s\S]*Number\(item\.id\)/.test(block),
  'Bling import should match existing products by bling_id from the VPS list',
);

assert(
  !/\.from\('products'\)[\s\S]{0,260}\.select\('id, model_id'\)[\s\S]{0,260}\.eq\('bling_id'/.test(block),
  'Bling import must not read duplicate products directly from Supabase',
);

console.log('Bling import duplicate check reads products from VPS');
