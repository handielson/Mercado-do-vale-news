import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/catalog/ProductRatingBadge.tsx', import.meta.url), 'utf8');

assert.match(source, /if\s*\(\s*count\s*===\s*0\s*\)\s*{\s*return\s*<div[^>]+h-4[^>]+aria-hidden="true"/s);
assert.doesNotMatch(source, /if\s*\(\s*count\s*===\s*0\s*\)\s*{\s*return\s+null\b/s);
