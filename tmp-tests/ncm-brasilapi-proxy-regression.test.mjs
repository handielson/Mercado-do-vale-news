import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

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

assert.match(
