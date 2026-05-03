import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRemoteDerivativeCommand } from '../tools/remote-image-derivative-command.mjs';

const dryRun = buildRemoteDerivativeCommand({ limit: 1 });
assert.match(dryRun, /\/var\/www\/mdv-api/);
assert.match(dryRun, /base64 -d \| node - --limit 1/);
assert.doesNotMatch(dryRun, /--apply/);

const apply = buildRemoteDerivativeCommand({ limit: 1, apply: true, skipExisting: true });
assert.match(apply, /--limit 1 --apply --skip-existing/);

const summary = buildRemoteDerivativeCommand({
  limit: 450,
  apply: true,
  skipExisting: true,
  summary: true,
});
assert.match(summary, /--limit 450 --apply --skip-existing --summary/);

const lowThreshold = buildRemoteDerivativeCommand({
  limit: 20,
  apply: true,
  skipExisting: true,
  minBytes: 10240,
});
assert.match(lowThreshold, /--limit 20 --apply --skip-existing --min-bytes 10240/);

const source = fs.readFileSync('tools/remote-image-derivative-command.mjs', 'utf8');
assert.match(source, /const optimizableExts = new Set\(\['\.jpg', '\.jpeg', '\.png', '\.webp', '\.avif'\]\)/);
assert.match(source, /lower\.includes\('\/legacy\/external\/'\)/);
assert.match(source, /function isImmutableImageDerivative/);

const focused = buildRemoteDerivativeCommand({
  limit: 1,
  apply: true,
  skipExisting: true,
  contains: 'legacy/external/external/e3771d34b703c814',
});
assert.match(focused, /--contains legacy\/external\/external\/e3771d34b703c814/);
