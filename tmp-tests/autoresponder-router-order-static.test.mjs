import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync('services/autoresponder/engine/router.js', 'utf8');

const expectedOrder = [
  'activeFlow',
  'manualRule',
  'knownIntent',
  'productSearch',
  'controlledAi',
  'globalFallback',
];

let lastIndex = -1;
for (const token of expectedOrder) {
  const index = router.indexOf(token);
  assert.ok(index > lastIndex, `router must check ${token} after previous stage`);
  lastIndex = index;
}

assert.ok(router.includes("if (state.flow !== 'none')"), 'router must prioritize active flow');
assert.ok(router.includes('controlledAi'), 'router must keep AI behind deterministic handlers');

console.log('autoresponder router order static checks passed');
