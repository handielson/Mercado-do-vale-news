import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync('schemas/product.ts', 'utf8');
assert.match(schema, /superRefine/, 'product schema must validate IMEI specs on submit');
assert.match(schema, /\^\[0-9\]\{15\}\$/, 'IMEI validation must require exactly 15 numeric digits');
assert.match(schema, /path:\s*\['specs',\s*'imei1'\]/, 'IMEI 1 validation must point to specs.imei1');
assert.match(schema, /path:\s*\['specs',\s*'imei2'\]/, 'IMEI 2 validation must point to specs.imei2');
