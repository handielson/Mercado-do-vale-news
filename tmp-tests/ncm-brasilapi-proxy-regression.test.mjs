import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const widgetSource = readFileSync('components/admin/NcmSearchWidget.tsx', 'utf8');

assert.match(
  widgetSource,
  /fetchNcmResults/,
  'NcmSearchWidget should use a shared same-origin fetch helper'
);

assert.doesNotMatch(
  widgetSource,
  /fetch\(`https:\/\/brasilapi\.com\.br\/api\/ncm\/v1/,
  'NcmSearchWidget must not fetch BrasilAPI directly from the browser'
);

assert.ok(existsSync('api/brasilapi-ncm.ts'), 'same-origin BrasilAPI NCM proxy route should exist');

const apiSource = readFileSync('api/brasilapi-ncm.ts', 'utf8');
assert.match(apiSource, /brasilapi\.com\.br\/api\/ncm\/v1/, 'proxy route should call BrasilAPI NCM upstream');
assert.match(apiSource, /s-maxage/, 'proxy route should define edge cache headers');

console.log('NCM BrasilAPI proxy regression ok');
