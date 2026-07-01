import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /params\.set\('keyword',\s*trimmed\)/,
  'Searchable Shopee attributes must also send keyword for compatibility with older catalog proxies.'
);

assert.match(
  page,
  /params\.set\('value_name',\s*trimmed\)/,
  'Searchable Shopee attributes must send value_name, the documented Shopee search parameter.'
);

assert.match(
  page,
  /entry\?\.value_name[\s\S]*entry\?\.display_value_name[\s\S]*entry\?\.original_value_name[\s\S]*entry\?\.name/,
  'Searchable Shopee attribute options must read every known value-name field returned by the API.'
);

console.log('shopee searchable attribute keyword static checks passed');
