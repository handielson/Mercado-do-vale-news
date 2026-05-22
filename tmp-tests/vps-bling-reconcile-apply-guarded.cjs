const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const reviewPath = process.env.BLING_RECONCILE_REVIEW_PATH || path.join(root, 'reports', 'bling-reconcile-review.json');
const detailsPath = process.env.BLING_RECONCILE_DETAILS_PATH || path.join(root, 'tmp-tests', 'vps-bling-reconcile-dry-run-details-output.json');
const MAX_REVIEW_AGE_MS = Number(process.env.BLING_RECONCILE_MAX_REVIEW_AGE_MS || 30 * 60 * 1000);

const APPLY = process.env.DRY_RUN === 'false' && process.env.CONFIRM_BLING_RECONCILE_APPLY === 'I_UNDERSTAND_BLING_RECONCILE_APPLY';
const ZEROING_REVIEWED = process.env.CONFIRM_BLING_RECONCILE_ZEROING === 'I_REVIEWED_STOCK_ZEROING';
const REVIEWED_ZEROING_SKUS = process.env.CONFIRM_BLING_RECONCILE_ZEROING_SKUS || '';
const UNSAFE_RENAMES_REVIEWED = process.env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES === 'I_REVIEWED_UNSAFE_RENAMES';
const REVIEWED_UNSAFE_RENAME_SKUS = process.env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS || '';
const CONFIRMED_SOURCE_SHA256 = process.env.CONFIRM_BLING_RECONCILE_SOURCE_SHA256 || '';
const PREFLIGHT_ONLY = process.env.BLING_RECONCILE_PREFLIGHT_ONLY === '1';

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr, code });
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function readLocalReview() {
  if (!fs.existsSync(reviewPath)) {
    return { ok: false, error: 'missing_review', path: 'reports/bling-reconcile-review.json' };
  }
  return JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function reviewAgeMs(review) {
  const generatedAt = new Date(review.generatedAt || 0).getTime();
  if (!Number.isFinite(generatedAt) || generatedAt <= 0) return Number.POSITIVE_INFINITY;
  return Date.now() - generatedAt;
}

function normalizeSkuList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items
    .map((sku) => String(sku || '').trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

async function main() {
  if (!APPLY) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'dry_run_enabled',
      required: {
        DRY_RUN: 'false',
        CONFIRM_BLING_RECONCILE_APPLY: 'I_UNDERSTAND_BLING_RECONCILE_APPLY',
        CONFIRM_BLING_RECONCILE_ZEROING: 'I_REVIEWED_STOCK_ZEROING',
        CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES: 'I_REVIEWED_UNSAFE_RENAMES',
      },
      note: 'No reconcile changes were applied.',
    }, null, 2));
    return;
  }

  const review = readLocalReview();
  const expectedSourceHash = review.source?.sha256 || '';
  const currentSourceHash = fs.existsSync(detailsPath) ? sha256File(detailsPath) : '';
  if (!expectedSourceHash || expectedSourceHash !== currentSourceHash) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'review_source_hash_mismatch',
      note: 'Regenerate reports/bling-reconcile-review.json from tmp-tests/vps-bling-reconcile-dry-run-details-output.json before applying.',
    }, null, 2));
    return;
  }
  if (CONFIRMED_SOURCE_SHA256 !== expectedSourceHash) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'source_hash_confirmation_mismatch',
      required: {
        CONFIRM_BLING_RECONCILE_SOURCE_SHA256: expectedSourceHash,
      },
      note: 'Confirm the exact reviewed dry-run source hash before applying reconcile changes.',
    }, null, 2));
    return;
  }

  const ageMs = reviewAgeMs(review);
  if (ageMs > MAX_REVIEW_AGE_MS) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'stale_review',
      reviewGeneratedAt: review.generatedAt || null,
      maxReviewAgeMinutes: Math.round(MAX_REVIEW_AGE_MS / 60000),
      note: 'Regenerate the dry-run details and review before applying reconcile changes.',
    }, null, 2));
    return;
  }

  const riskFlags = Array.isArray(review.riskFlags) ? review.riskFlags : [];
  if (riskFlags.includes('stock_zeroing_present') && !ZEROING_REVIEWED) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'stock_zeroing_present',
      required: {
        CONFIRM_BLING_RECONCILE_ZEROING: 'I_REVIEWED_STOCK_ZEROING',
      },
      stockZeroing: review.samples?.stockZeroing || [],
      note: 'Review stock zeroing SKUs before applying reconcile changes.',
    }, null, 2));
    return;
  }
  if (riskFlags.includes('stock_zeroing_present')) {
    const expectedZeroingSkus = normalizeSkuList(review.samples?.stockZeroing || []);
    const reviewedZeroingSkus = normalizeSkuList(REVIEWED_ZEROING_SKUS);
    if (expectedZeroingSkus.join(',') !== reviewedZeroingSkus.join(',')) {
      console.log(JSON.stringify({
        ok: true,
        applied: false,
        reason: 'stock_zeroing_sku_list_mismatch',
        required: {
          CONFIRM_BLING_RECONCILE_ZEROING_SKUS: expectedZeroingSkus.join(','),
        },
        receivedCount: reviewedZeroingSkus.length,
        note: 'Confirm the exact stock-zeroing SKU list before applying reconcile changes.',
      }, null, 2));
      return;
    }
  }
  if (riskFlags.includes('name_changes_not_limited_to_color_suffix') && !UNSAFE_RENAMES_REVIEWED) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'name_changes_not_limited_to_color_suffix',
      required: {
        CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES: 'I_REVIEWED_UNSAFE_RENAMES',
      },
      unsafeRenames: review.samples?.unsafeRenames || [],
      note: 'Review unsafe rename SKUs before applying reconcile changes.',
    }, null, 2));
    return;
  }
  if (riskFlags.includes('name_changes_not_limited_to_color_suffix')) {
    const expectedUnsafeRenameSkus = normalizeSkuList(review.samples?.unsafeRenames || []);
    const reviewedUnsafeRenameSkus = normalizeSkuList(REVIEWED_UNSAFE_RENAME_SKUS);
    if (expectedUnsafeRenameSkus.join(',') !== reviewedUnsafeRenameSkus.join(',')) {
      console.log(JSON.stringify({
        ok: true,
        applied: false,
        reason: 'unsafe_rename_sku_list_mismatch',
        required: {
          CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS: expectedUnsafeRenameSkus.join(','),
        },
        receivedCount: reviewedUnsafeRenameSkus.length,
        note: 'Confirm the exact unsafe-rename SKU list before applying reconcile changes.',
      }, null, 2));
      return;
    }
  }

  if (PREFLIGHT_ONLY) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'preflight_only',
      localGuardsPassed: true,
      stockZeroing: review.samples?.stockZeroing || [],
      unsafeRenames: review.samples?.unsafeRenames || [],
      note: 'Local reconcile apply guards passed. SSH/apply was intentionally skipped.',
    }, null, 2));
    return;
  }

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 45000,
      });
  });

  const remoteScript = `
set -eu
cd /var/www/mdv-api
if [ -f /var/www/mdv-api/.env ]; then
  set -a
  . /var/www/mdv-api/.env
  set +a
fi
if [ -z "\${CRON_SECRET:-}" ]; then
  echo '{"ok":false,"error":"CRON_SECRET missing"}'
  exit 0
fi
curl -sS \\
  -H "Authorization: Bearer \${CRON_SECRET}" \\
  "http://127.0.0.1:4000/api/bling?resource=reconcile"
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const payload = JSON.parse(result.stdout);
  console.log(JSON.stringify({
    ok: payload?.ok === true,
    applied: payload?.applied || null,
    failed_count: Array.isArray(payload?.failed) ? payload.failed.length : null,
    planned: payload?.planned || null,
    totals: payload?.totals || null,
    note: 'Apply mode prints only counts. Inspect API logs if failures are reported.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
