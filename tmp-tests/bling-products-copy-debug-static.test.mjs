import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');
const fetchStart = source.indexOf('async function handleFetchBlingProducts');
const fetchEnd = source.indexOf('async function handleImport', fetchStart);
const fetchBody = source.slice(fetchStart, fetchEnd);

assert.ok(fetchStart > -1 && fetchEnd > fetchStart, 'BlingPage must have handleFetchBlingProducts');
assert.match(
  source,
  /const \[lastBlingFetchDebug,\s*setLastBlingFetchDebug\] = useState<[\s\S]*?\| null>\(null\)/,
  'Bling product search must keep the last copyable debug payload in state',
);
assert.match(
  fetchBody,
  /setLastBlingFetchDebug\(null\)/,
  'Bling product search must clear stale debug before a new fetch',
);
assert.match(
  fetchBody,
  /buildBlingFetchDebugPayload\(/,
  'Bling product search errors must build a structured debug payload',
);
assert.match(
  source,
  /function buildBlingFetchDebugPayload\(/,
  'BlingPage must format a structured debug payload for copying',
);
assert.match(
  source,
  /navigator\.clipboard\.writeText\(lastBlingFetchDebug\.text\)/,
  'BlingPage must copy the full debug text to clipboard',
);
assert.match(
  source,
  /Copiar debug/,
  'BlingPage must render a Copiar debug button',
);
assert.match(
  source,
  /<textarea[\s\S]*value=\{lastBlingFetchDebug\.text\}/,
  'BlingPage must render the full debug text so the operator can manually copy it',
);

console.log('bling products copy debug static checks passed');
