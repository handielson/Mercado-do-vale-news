import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const scriptPath = 'tools/import-models-from-supabase-to-vps.cjs';

assert.equal(existsSync(scriptPath), true, 'model migrator script must exist');

const source = readFileSync(scriptPath, 'utf8');

assert.match(source, /SUPABASE_PAGE_SIZE/, 'migrator must page through Supabase models');
assert.match(source, /\/rest\/v1\/models/, 'migrator must read the Supabase models table');
assert.match(source, /INSERT INTO.*models/, 'migrator must write into VPS MySQL models table');
assert.match(source, /ON DUPLICATE KEY UPDATE/, 'migrator must update existing VPS models instead of duplicating rows');
assert.match(source, /--apply/, 'migrator must require --apply before mutating VPS data');
assert.match(source, /withoutSecrets/, 'migrator logs must avoid printing env secrets');
assert.match(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY|SUPABASE_KEY/, 'migrator must use server-side Supabase credentials only');

console.log('Supabase models to VPS migrator static checks passed');
