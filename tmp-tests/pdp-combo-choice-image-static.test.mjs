import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicProductPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  publicProductPage,
  /const\s+handleComboOptionSelect\s*=\s*\(\s*groupKey:\s*string,\s*option:\s*any\s*\)\s*=>/u,
  'PDP must centralize combo option selection so image updates stay coupled to the selected variation',
);

assert.match(
  publicProductPage,
  /setSelectedComboOptions\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*\[groupKey\]:\s*option\s*\}\)\)/u,
  'combo option handler must preserve the selected option for cart combo selections',
);

assert.match(
  publicProductPage,
  /Array\.isArray\(option\?\.images\)[\s\S]*setSelectedImage\(option\.images\[0\]\)/u,
  'combo option handler must switch the PDP main image to the selected option image',
);

assert.match(
  publicProductPage,
  /onClick=\{\(\)\s*=>\s*handleComboOptionSelect\(group\.group_key,\s*option\)\}/u,
  'combo option buttons must use the image-aware selection handler',
);

console.log('pdp combo choice image static guard ok');
