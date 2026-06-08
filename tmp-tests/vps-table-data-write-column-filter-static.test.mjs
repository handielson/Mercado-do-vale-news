import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /async function getTableDataColumnNames\(/,
    `${file} must cache real table columns for table-data writes`,
  );

  assert.match(
    source,
    /function filterTableDataWritableEntries\(/,
    `${file} must filter payload fields against real table columns`,
  );

  const postStart = source.indexOf("fastify.post('/table-data/:name'");
  const bulkStart = source.indexOf("fastify.post('/table-data/:name/bulk'");
  const patchStart = source.indexOf("fastify.patch('/table-data/:name/:pkValue'");
  assert.ok(postStart >= 0, `${file} must expose table-data POST`);
  assert.ok(bulkStart > postStart, `${file} must expose table-data bulk POST after POST`);
  assert.ok(patchStart > bulkStart, `${file} must expose table-data PATCH after bulk POST`);

  const postBody = source.slice(postStart, bulkStart);
  const bulkBody = source.slice(bulkStart, patchStart);
  const patchBody = source.slice(patchStart, source.indexOf("fastify.delete('/table-data/:name/:pkValue'", patchStart));

  assert.match(postBody, /filterTableDataWritableEntries\((?:body|insertBody),\s*columnNames/, `${file} POST must filter unknown columns`);
  assert.match(bulkBody, /filterTableDataWritableEntries\(row,\s*columnNames/, `${file} bulk POST must filter unknown columns per row`);
  assert.match(patchBody, /filterTableDataWritableEntries\(body,\s*columnNames/, `${file} PATCH must filter unknown columns`);
  assert.doesNotMatch(postBody, /const cols = Object\.keys\(body\)/, `${file} POST must not blindly insert every payload key`);
}

console.log('VPS table-data write column filtering static checks passed');
