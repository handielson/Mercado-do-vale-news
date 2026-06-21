import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const blingPolicy = readFileSync('services/blingNameSyncPolicy.js', 'utf8');

assert.match(
  source,
  /const HIDDEN_KEYS = new Set\(\[[\s\S]*'bling_name_sync'/,
  'public product specifications must hide the internal Bling name ownership marker',
);

assert.match(
  source,
  /if \([\s\S]*HIDDEN_KEYS\.has\(normalizePdpSpecText\(key\)\)[\s\S]*\|\|[\s\S]*HIDDEN_KEYS\.has\(normalizePdpSpecText\(label\)\)[\s\S]*\) return;/,
  'all public specification paths must pass through the normalized hidden-key barrier',
);

assert.match(
  blingPolicy,
  /bling_name_sync/,
  'Bling name sync metadata must remain available internally',
);

console.log('public product internal specs static checks passed');