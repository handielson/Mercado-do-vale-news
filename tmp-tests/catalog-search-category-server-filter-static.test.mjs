import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/catalogService.ts', 'utf8');
const searchStart = source.indexOf('// Busca por texto → VPS server-side search');
const searchEnd = source.indexOf('if (!vpsRaw)', searchStart);

assert(searchStart >= 0 && searchEnd > searchStart, 'catalog text-search branch should exist');

const searchBranch = source.slice(searchStart, searchEnd);
assert.match(
  searchBranch,
  /category:\s*filters\?\.categories\?\.join\(','\)\s*\|\|\s*undefined/,
  'catalog text search must send selected categories to the VPS before its result limit is applied',
);

console.log('catalog search category server filter regression ok');
