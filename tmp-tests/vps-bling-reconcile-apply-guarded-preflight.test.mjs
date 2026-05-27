import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = path.join(tmpdir(), `mdv-reconcile-preflight-${process.pid}`);
mkdirSync(tempDir, { recursive: true });

function parseTrailingJson(stdout) {
  const text = String(stdout || '').trim();
  const jsonStart = Math.max(text.lastIndexOf('\n{'), text.lastIndexOf('\r\n{'));
  return JSON.parse(jsonStart >= 0 ? text.slice(jsonStart + 1) : text);
}

try {
  const reviewPath = path.join(tempDir, 'review.json');
  const detailsPath = path.join(tempDir, 'details.json');
  const detailsJson = JSON.stringify({ ok: true, dryRun: true, details: {} });
  const detailsHash = createHash('sha256').update(detailsJson).digest('hex');

  writeFileSync(detailsPath, detailsJson);
  writeFileSync(reviewPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: { sha256: detailsHash },
    riskFlags: ['stock_zeroing_present'],
    samples: { stockZeroing: ['SGB400', 'EP-743-BRA'] },
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
        CONFIRM_BLING_RECONCILE_ZEROING: 'I_REVIEWED_STOCK_ZEROING',
        CONFIRM_BLING_RECONCILE_ZEROING_SKUS: 'EP-743-BRA,SGB400',
        CONFIRM_BLING_RECONCILE_SOURCE_SHA256: detailsHash,
        BLING_RECONCILE_PREFLIGHT_ONLY: '1',
        BLING_RECONCILE_REVIEW_PATH: reviewPath,
        BLING_RECONCILE_DETAILS_PATH: detailsPath,
      },
    },
  );

  const payload = parseTrailingJson(stdout);
  assert.equal(payload.applied, false);
  assert.equal(payload.reason, 'preflight_only');
  assert.equal(payload.localGuardsPassed, true);
  assert.deepEqual(payload.stockZeroing, ['SGB400', 'EP-743-BRA']);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('vps Bling reconcile apply guard preflight ok');
