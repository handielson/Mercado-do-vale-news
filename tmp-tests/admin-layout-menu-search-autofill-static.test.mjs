import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(
  source,
  /function\s+isLikelyCredentialAutofill\(/,
  'AdminLayout must detect credential autofill values in the menu search',
);

assert.match(
  source,
  /isLikelyCredentialAutofill\(nextSearch\)/,
  'AdminLayout menu search changes must clear likely credential autofill values',
);

assert.match(
  source,
  /name="admin-menu-search"/,
  'AdminLayout menu search input must use a non-login field name',
);

assert.match(
  source,
  /autoComplete="off"/,
  'AdminLayout menu search input must disable browser credential autofill',
);

console.log('admin layout menu search autofill static test ok');
