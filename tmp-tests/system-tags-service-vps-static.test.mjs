import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/systemTagsService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'system tags service must not use Supabase directly');
assert.match(source, /vpsClient/, 'system tags service must use vpsClient');
assert.match(source, /\/table-data\/system_tags/, 'system tags must use the VPS table-data endpoint');
assert.match(source, /slugName|toSlug|replace\(\s*\/\\s\+\/g/, 'system tags must preserve name slug normalization');
assert.match(source, /listByContext/, 'system tags must preserve context filtering');
assert.match(source, /toggleActive/, 'system tags must preserve active toggle');
assert.match(source, /vpsClient\.delete/, 'system tags delete must use VPS DELETE');

console.log('system tags VPS static checks passed');
