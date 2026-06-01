import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const scriptPath = 'tools/backfill-custom-fields-vps.cjs';

assert.equal(existsSync(scriptPath), true, 'custom fields backfill script must exist');

const source = readFileSync(scriptPath, 'utf8');

assert.match(source, /\/rest\/v1\/custom_fields/, 'backfill must read Supabase custom_fields when available');
assert.match(source, /FROM .*categories/, 'backfill must scan categories.config keys from VPS');
assert.match(source, /INSERT INTO .*custom_fields/, 'backfill must write into VPS custom_fields');
assert.match(source, /ON DUPLICATE KEY UPDATE/, 'backfill must upsert instead of duplicating fields');
assert.match(source, /--apply/, 'backfill must be dry-run by default and require --apply to write');
assert.match(source, /withoutSecrets/, 'backfill logs must avoid printing env secrets');
assert.match(source, /FIELD_LABELS/, 'backfill must include labels for known migrated category config fields');

console.log('custom fields VPS backfill static checks passed');
