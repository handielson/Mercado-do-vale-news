import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'components/catalog/CompareModal.tsx',
  'components/catalog/ProductDetailsModal.tsx',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /versionService\.list\(\)/,
    `${file} must load version labels through the VPS version service`,
  );
  assert.match(
    source,
    /versionsData\.map\(\(v(?::\s*Version)?\)\s*=>\s*\[v\.id,\s*v\.name\]\)/,
    `${file} must build the version label map from VPS version rows`,
  );
  assert.doesNotMatch(
    source,
    /supabase\.from\(['"]versions['"]\)/,
    `${file} must not query Supabase versions directly`,
  );
}

console.log('catalog version label VPS static checks passed');
