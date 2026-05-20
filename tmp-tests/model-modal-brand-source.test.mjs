import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const loadDataBody = source.match(/const loadData = async \(\) => \{([\s\S]*?)\n    \};/)?.[1] || '';

assert.match(
  loadDataBody,
  /brandService\.list\(\)/,
  'Model modal must load the full brand list used by ModelsPage, so legacy/inactive flag values do not hide every brand'
);

assert.doesNotMatch(
  loadDataBody,
  /brandService\.listActive\(\)/,
  'Model modal must not use listActive because legacy brand active flags can make the selector empty'
);

console.log('model-modal-brand-source regression passed');
