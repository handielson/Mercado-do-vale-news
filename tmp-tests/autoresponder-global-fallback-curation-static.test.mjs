import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');

[
  'global_fallback',
  'curation_candidate',
  'consecutive_fallbacks',
  'auto_pause_fallback_minutes',
].forEach((needle) => {
  assert.ok(server.includes(needle), `server must include ${needle}`);
});

console.log('autoresponder global fallback curation static checks passed');
