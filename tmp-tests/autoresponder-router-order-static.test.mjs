import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync('services/autoresponder/engine/router.js', 'utf8');

const expectedOrder = [
  'activeFlow',
  'controlledAi',
  'manualRule',
  'knownIntent',
  'productSearch',
  'globalFallback',
];

let lastIndex = -1;
for (const token of expectedOrder) {
  const index = router.indexOf(token);
  assert.ok(index > lastIndex, `router must check ${token} after previous stage`);
  lastIndex = index;
}

assert.ok(router.includes("if (state.flow !== 'none')"), 'router must prioritize active flow');
assert.ok(router.includes('controlledAi'), 'router must let controlled AI classify before predefined/manual rules');

console.log('autoresponder router order static checks passed');
