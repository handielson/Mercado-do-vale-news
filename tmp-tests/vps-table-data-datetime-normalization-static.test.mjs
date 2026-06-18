import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const filePath of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(filePath, 'utf8');
  const normalizerMatch = source.match(/function normalizeTableDataValue\(value\) \{[\s\S]*?\n\}/);

  assert.ok(normalizerMatch, `${filePath} must define normalizeTableDataValue`);
  assert.match(
    normalizerMatch[0],
    /T\\d\{2\}:\\d\{2\}:\\d\{2\}[\s\S]*replace\(['"]T['"], ['"] ['"]\)/,
    `${filePath} table-data normalizer must convert ISO timestamps to MySQL DATETIME format`,
  );
  assert.match(
    normalizerMatch[0],
    /(?:Z|\[zZ\])[\s\S]*slice\(0,\s*19\)/,
    `${filePath} table-data normalizer must trim UTC ISO timestamps before writing MySQL DATETIME columns`,
  );
}

console.log('VPS table-data datetime normalization static checks passed');
