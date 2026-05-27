import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '..');

function parseTrailingJson(stdout) {
  const text = String(stdout || '').trim();
  const jsonStart = Math.max(text.lastIndexOf('\n{'), text.lastIndexOf('\r\n{'));
  const payload = jsonStart >= 0 ? text.slice(jsonStart + 1) : text;
  return JSON.parse(payload);
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

if (process.argv.includes('--apply')) {
  console.error(JSON.stringify({
    ok: false,
    error: 'apply_not_supported',
    note: 'This command only regenerates the local review and runs guarded preflight.',
  }, null, 2));
  process.exit(2);
}

const inputPath = path.resolve(argValue('--input', path.join(root, 'tmp-tests', 'vps-bling-reconcile-dry-run-details-output.json')));
const markdownOutput = path.resolve(argValue('--markdown-output', path.join(root, 'reports', 'bling-reconcile-review.md')));
const jsonOutput = path.resolve(argValue('--json-output', path.join(root, 'reports', 'bling-reconcile-review.json')));

execFileSync(
  process.execPath,
  [
    'tools/review-bling-reconcile-plan.mjs',
    '--input',
    inputPath,
    '--markdown-output',
    markdownOutput,
    '--json-output',
    jsonOutput,
  ],
  { cwd: root, stdio: 'pipe', encoding: 'utf8' },
);

const review = JSON.parse(readFileSync(jsonOutput, 'utf8'));
const zeroingSkus = argValue('--zeroing-skus', (review.samples?.stockZeroing || []).slice().sort().join(','));
const unsafeRenameSkus = argValue('--unsafe-rename-skus', (review.samples?.unsafeRenames || []).slice().sort().join(','));

const env = {
  ...process.env,
  DRY_RUN: 'false',
  CONFIRM_BLING_RECONCILE_APPLY: 'I_UNDERSTAND_BLING_RECONCILE_APPLY',
  CONFIRM_BLING_RECONCILE_SOURCE_SHA256: review.source?.sha256 || '',
  BLING_RECONCILE_PREFLIGHT_ONLY: '1',
  BLING_RECONCILE_REVIEW_PATH: jsonOutput,
  BLING_RECONCILE_DETAILS_PATH: inputPath,
};

if ((review.riskFlags || []).includes('stock_zeroing_present')) {
  env.CONFIRM_BLING_RECONCILE_ZEROING = 'I_REVIEWED_STOCK_ZEROING';
  env.CONFIRM_BLING_RECONCILE_ZEROING_SKUS = zeroingSkus;
}

if ((review.riskFlags || []).includes('name_changes_not_limited_to_color_suffix')) {
  env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES = 'I_REVIEWED_UNSAFE_RENAMES';
  env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS = unsafeRenameSkus;
}

let guard;
try {
  const stdout = execFileSync(
    process.execPath,
    ['tmp-tests/vps-bling-reconcile-apply-guarded.cjs'],
    { cwd: root, env, encoding: 'utf8' },
  );
  guard = parseTrailingJson(stdout);
} catch (error) {
  const payload = {
    ok: false,
    error: 'guard_failed',
    stdout: error.stdout || '',
    stderr: error.stderr || '',
    message: error.message || '',
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

const result = {
  ok: guard.ok === true && guard.localGuardsPassed === true,
  applied: false,
  reason: guard.reason,
  localGuardsPassed: guard.localGuardsPassed === true,
  summary: review.summary,
  riskFlags: review.riskFlags || [],
  requiredApplyEnv: {
    DRY_RUN: 'false',
    CONFIRM_BLING_RECONCILE_APPLY: 'I_UNDERSTAND_BLING_RECONCILE_APPLY',
    CONFIRM_BLING_RECONCILE_SOURCE_SHA256: review.source?.sha256 || '',
    ...(env.CONFIRM_BLING_RECONCILE_ZEROING ? {
      CONFIRM_BLING_RECONCILE_ZEROING: env.CONFIRM_BLING_RECONCILE_ZEROING,
      CONFIRM_BLING_RECONCILE_ZEROING_SKUS: env.CONFIRM_BLING_RECONCILE_ZEROING_SKUS,
    } : {}),
    ...(env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES ? {
      CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES: env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES,
      CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS: env.CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS,
    } : {}),
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
