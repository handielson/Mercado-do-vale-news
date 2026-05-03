import assert from 'node:assert/strict';
import { buildRemoteDerivativeCommand } from '../tools/remote-image-derivative-command.mjs';

const dryRun = buildRemoteDerivativeCommand({ limit: 1 });
assert.match(dryRun, /\/var\/www\/mdv-api/);
assert.match(dryRun, /base64 -d \| node - --limit 1/);
assert.doesNotMatch(dryRun, /--apply/);

const apply = buildRemoteDerivativeCommand({ limit: 1, apply: true, skipExisting: true });
assert.match(apply, /--limit 1 --apply --skip-existing/);
