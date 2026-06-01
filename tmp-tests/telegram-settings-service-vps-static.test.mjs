import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/telegramSettings.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'telegram settings service must not use Supabase directly');
assert.match(source, /vpsClient/, 'telegram settings service must use vpsClient');
assert.match(source, /\/table-data\/telegram_settings/, 'telegram settings must use the VPS table-data endpoint');
assert.match(source, /DEFAULT_TEMPLATES/, 'telegram settings must preserve default templates');
assert.match(source, /templates\.map/, 'telegram settings must preserve template compatibility normalization');

console.log('telegram settings VPS static checks passed');
