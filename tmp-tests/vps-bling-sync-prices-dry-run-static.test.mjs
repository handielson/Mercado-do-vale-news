import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /const dryRun = String\(query\?\.dryRun \|\| request\.body\?\.dryRun \|\| ''\)\.toLowerCase\(\) === 'true'/, `${file} must support dryRun=true for sync-prices-vps`);
  assert.match(source, /if \(dryRun\) \{[\s\S]*dryRun: true[\s\S]*wouldSync: vpsRows\.length[\s\S]*sample: vpsRows\.slice\(0, 3\)\.map/, `${file} must return a bounded dry-run summary`);
  assert.match(source, /if \(dryRun\)[\s\S]*return reply\.code\(200\)\.send/, `${file} must return before calling products batch in dry-run mode`);
  assert.match(source, /sample: vpsRows\.slice\(0, 3\)\.map\(\(row\) => \(\{[\s\S]*hasBlingId: !!row\.bling_id[\s\S]*hasParent: !!row\.parent_id/, `${file} must sanitize dry-run samples`);
}

console.log('vps Bling sync-prices dry-run static checks ok');
