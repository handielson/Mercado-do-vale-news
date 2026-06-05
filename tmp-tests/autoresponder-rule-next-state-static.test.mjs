import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

assert.ok(server.includes('next_state'), 'server must persist rule next_state');
assert.ok(server.includes('applyRuleNextState'), 'server must apply next_state after rule reply');
assert.ok(page.includes('Proximo estado'), 'admin must expose next state for question rules');

console.log('autoresponder rule next state static checks passed');
