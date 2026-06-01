import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/instagramScheduleService.ts', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'Instagram schedule service must not use Supabase directly');
assert.match(source, /vpsClient/, 'Instagram schedule service must use vpsClient');
assert.match(source, /\/table-data\/instagram_schedule/, 'Instagram schedule service must call the VPS table-data endpoint');
assert.match(source, /encodeURIComponent\(id\)/, 'Instagram schedule row mutations must safely address ids');
assert.match(source, /day_of_week/, 'Instagram schedule filters must preserve day_of_week behavior');
assert.match(source, /active/, 'Instagram schedule filters must preserve active/toggle behavior');

console.log('instagram schedule service VPS static checks passed');
