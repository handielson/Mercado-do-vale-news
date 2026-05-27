import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = path.join(tmpdir(), `mdv-reconcile-readiness-${process.pid}`);
mkdirSync(tempDir, { recursive: true });

try {
  const inputPath = path.join(tempDir, 'details.json');
  const markdownOutput = path.join(tempDir, 'review.md');
  const jsonOutput = path.join(tempDir, 'review.json');

  writeFileSync(inputPath, JSON.stringify({
    ok: true,
    dryRun: true,
    planned: { stockChanges: 1, nameChanges: 1 },
    details: {
      stockChanges: [{ sku: 'ABC', previousStock: 1, nextStock: 0 }],
      nameChanges: [{ sku: 'XYZ', previousName: 'Produto A', nextName: 'Outro Produto' }],
    },
  }));

  const stdout = execFileSync(
    process.execPath,
    [
      'tools/check-bling-reconcile-apply-readiness.mjs',
      '--input',
      inputPath,
      '--markdown-output',
      markdownOutput,
      '--json-output',
      jsonOutput,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const result = JSON.parse(stdout.slice(stdout.indexOf('{')));

  assert.equal(result.ok, true);
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'preflight_only');
  assert.equal(result.localGuardsPassed, true);
  assert.equal(result.requiredApplyEnv.CONFIRM_BLING_RECONCILE_ZEROING_SKUS, 'ABC');
  assert.equal(result.requiredApplyEnv.CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS, 'XYZ');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('bling reconcile apply readiness CLI ok');
