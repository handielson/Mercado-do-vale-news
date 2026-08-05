import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/hooks/useEANAutofill.ts', 'utf8');

assert.match(source, /const\s+shouldFillEmpty\s*=\s*\(fieldName:\s*string\)/);
assert.match(source, /shouldFill\(fieldName\)\s*&&\s*!hasValue\(watch\(fieldName as any\)\)/);
assert.match(source, /shouldFillEmpty\('price_retail'\)/);
assert.match(source, /const\s+hasProductIdentity\s*=/);
assert.match(source, /shouldFillEmpty\('images'\)\s*&&\s*!hasProductIdentity/);

console.log('EAN autofill priority static guard ok');
