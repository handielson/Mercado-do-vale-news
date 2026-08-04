import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/instagramScheduleService.ts', 'utf8');
const migration = readFileSync('migrations/009_instagram_schedule.sql', 'utf8');

assert.doesNotMatch(source, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'Instagram schedule service must not use Supabase directly');
assert.match(source, /vpsClient/, 'Instagram schedule service must use vpsClient');
assert.match(source, /\/table-data\/instagram_schedule/, 'Instagram schedule service must call the VPS table-data endpoint');
assert.match(source, /encodeURIComponent\(id\)/, 'Instagram schedule row mutations must safely address ids');
assert.match(source, /day_of_week/, 'Instagram schedule filters must preserve day_of_week behavior');
assert.match(source, /active/, 'Instagram schedule filters must preserve active/toggle behavior');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(
    server,
    /CREATE TABLE IF NOT EXISTS instagram_schedule[\s\S]*?idx_instagram_schedule_day/,
    `${serverFile} must create the Instagram schedule table during API boot`,
  );
}
assert.match(migration, /CREATE TABLE IF NOT EXISTS instagram_schedule/);
assert.match(migration, /content_type ENUM\('story', 'reels', 'carrossel', 'post'\)/);

console.log('instagram schedule service VPS static checks passed');
