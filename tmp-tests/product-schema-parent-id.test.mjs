import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync('schemas/product.ts', 'utf8');

assert.match(
  schema,
  /parent_id:\s*z\.union/,
  'product schema must preserve parent_id from the Produto Pai selector',
);

console.log('product schema parent_id static check passed');
