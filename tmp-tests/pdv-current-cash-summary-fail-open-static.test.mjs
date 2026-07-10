import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const currentRoute = source.match(/fastify\.get\('\/pdv\/cash-sessions\/current'[\s\S]*?\n\}\);/);
  assert.ok(currentRoute, `${file} must expose the current cash session route`);
  assert.match(currentRoute[0], /try\s*\{\s*summary = await computeCashSessionSummary/, `${file} must treat the current summary as optional`);
  assert.match(currentRoute[0], /Current session summary unavailable/, `${file} must log a summary failure without failing the session lookup`);
  assert.match(currentRoute[0], /return \{ session: mapCashSessionRow\(session\), \.\.\.\(summary \? \{ summary \} : \{\}\) \}/, `${file} must return an open session even without summary`);
}

console.log('current cash summary fail-open static checks ok');
