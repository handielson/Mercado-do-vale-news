import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = path.join(tmpdir(), `mdv-reconcile-guard-${process.pid}`);
mkdirSync(tempDir, { recursive: true });

function parseTrailingJson(stdout) {
  const text = String(stdout || '').trim();
  const jsonStart = Math.max(text.lastIndexOf('\n{'), text.lastIndexOf('\r\n{'));
  return JSON.parse(jsonStart >= 0 ? text.slice(jsonStart + 1) : text);
}

try {
  const reviewPath = path.join(tempDir, 'review.json');
  const detailsPath = path.join(tempDir, 'details.json');

  writeFileSync(detailsPath, JSON.stringify({ ok: true, dryRun: true, details: {} }));
  writeFileSync(reviewPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: { sha256: '0'.repeat(64) },
    riskFlags: [],
  }));

  const stdout = execFileSync(
    process.execPath,
    ['tmp-tests/vps-bling-reconcile-apply-guarded.cjs'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DRY_RUN: 'false',
        CONFIRM_BLING_RECONCILE_APPLY: 'I_UNDERSTAND_BLING_RECONCILE_APPLY',
        BLING_RECONCILE_REVIEW_PATH: reviewPath,
        BLING_RECONCILE_DETAILS_PATH: detailsPath,
      },
    },
  );

  const payload = parseTrailingJson(stdout);
  assert.equal(payload.applied, false);
  assert.equal(payload.reason, 'review_source_hash_mismatch');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('vps Bling reconcile apply guard hash mismatch ok');
