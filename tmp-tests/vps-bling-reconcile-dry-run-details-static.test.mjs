import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /const includeDetails = String\(query\?\.details \|\| request\.body\?\.details \|\| ''\)\.toLowerCase\(\) === 'true'/, `${file} must gate dry-run details behind details=true`);
  assert.match(source, /function summarizeBlingReconcilePlanDetailsVps\(/, `${file} must summarize reconcile plan details in a dedicated helper`);
  assert.match(source, /stockChanges: plan\.stockChanges\.slice\(0, limit\)\.map/, `${file} must cap stock detail output`);
  assert.match(source, /nameChanges: plan\.nameChanges\.slice\(0, limit\)\.map/, `${file} must cap name detail output`);
  assert.match(source, /\.\.\.\(includeDetails \? \{ details: summarizeBlingReconcilePlanDetailsVps\(plan\) \} : \{\}\)/, `${file} must only include details when explicitly requested`);
}

console.log('vps Bling reconcile dry-run details static checks ok');
