import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/brands.ts', 'utf8');
const listActiveBody = source.match(/async function listActive\(\): Promise<Brand\[]> \{([\s\S]*?)\n\}/)?.[1] || '';

assert.match(
  listActiveBody,
  /\.or\(['"]active\.eq\.true,active\.is\.null['"]\)/,
  'brandService.listActive must include active null rows because legacy brands are treated as active'
);

assert.doesNotMatch(
  listActiveBody,
  /\.eq\(['"]active['"],\s*true\)/,
  'brandService.listActive must not exclude legacy brands with active null'
);

console.log('brand list active null filter regression ok');
