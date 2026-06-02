import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/vpsClient.ts', 'utf8');

const start = source.indexOf('delete: async (path: string): Promise<void> => {');
const end = source.indexOf('POST multipart/form-data', start);

assert.notEqual(start, -1, 'vpsClient.delete block should be present');
assert.notEqual(end, -1, 'vpsClient.upload block should follow delete block');

const deleteBlock = source.slice(start, end);

assert.match(
  deleteBlock,
  /delete\s+\(headers as Record<string, string>\)\['Content-Type'\];/,
  'vpsClient.delete must remove Content-Type because DELETE has no JSON body',
);

assert.doesNotMatch(
  deleteBlock,
  /body:\s*JSON\.stringify/,
  'vpsClient.delete should not send an empty JSON body',
);

console.log('vps client DELETE header static checks passed');
