import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const source = readFileSync(path.join(repoRoot, 'services', 'vpsApiService.ts'), 'utf8');

assert.match(
  source,
  /private\s+videoCheckCache\s*=\s*new Map/,
  'VPS API service must cache video checks on the client to avoid request storms from product cards',
);

assert.match(
  source,
  /private\s+videoCheckInFlight\s*=\s*new Map/,
  'VPS API service must de-duplicate concurrent video checks for the same SKU',
);

assert.doesNotMatch(
  source,
 /checkVideoBySku\(sku: string\)[\s\S]*fetchSafe<\{ exists: boolean; url\?: string \}>\(`\/check-video\?sku=\$\{encodeURIComponent\(sku\.trim\(\)\)\}`, true\)/,
  'checkVideoBySku must not force noCache=true because that appends _t and bypasses server/CDN caches',
);

console.log('check-video cache regression ok');
