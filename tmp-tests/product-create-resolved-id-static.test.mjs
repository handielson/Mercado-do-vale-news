import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../services/products.ts', import.meta.url), 'utf8');

assert.match(source, /result\.resolved\?\.find\(\(row\) => row\.requested_id === id\) \|\| result\.resolved\?\.\[0\]/);
assert.match(source, /const resolvedId = resolved\?\.id \|\| id/);
assert.match(source, /getProductById\(resolvedId, true\)/);
assert.match(source, /transformFromDB\(persistedRow \|\| \{ \.\.\.payload, id: resolvedId \}\)/);

console.log('product create resolved id static checks: OK');
