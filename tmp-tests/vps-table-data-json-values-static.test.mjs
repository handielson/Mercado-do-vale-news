import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const filePath of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(filePath, 'utf8');

  assert.match(source, /function normalizeTableDataValue/, `${filePath} must normalize table-data values`);
  assert.match(source, /JSON\.stringify\(value\)/, `${filePath} must stringify object and array values for MySQL JSON columns`);
  assert.match(source, /insertBody\.id = crypto\.randomUUID\(\)/, `${filePath} table-data POST must generate UUID ids before INSERT`);
  assert.match(source, /next\.id = crypto\.randomUUID\(\)/, `${filePath} table-data bulk POST must generate UUID ids before INSERT`);
  assert.match(source, /(?:Object\.values\(insertBody\)|entries)\.map\((?:normalizeTableDataValue|\(\[, value\]\) => normalizeTableDataValue\(value\))/, `${filePath} table-data POST must normalize values before INSERT`);
  assert.match(source, /cols\.map\(c => normalizeTableDataValue\(r\[c\]\)/, `${filePath} table-data bulk POST must normalize row values`);
  assert.match(source, /entries\.map\(\(\[, v\]\) => normalizeTableDataValue\(v\)\)/, `${filePath} table-data PATCH must normalize values before UPDATE`);
}

console.log('VPS table-data JSON value static checks passed');
