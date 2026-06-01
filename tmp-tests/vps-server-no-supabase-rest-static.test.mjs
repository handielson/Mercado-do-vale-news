import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.doesNotMatch(
    source,
    /SUPABASE_(?:URL|AUTH_KEY|SERVICE_ROLE_KEY|ANON_KEY)|VITE_SUPABASE|supabaseRest|getSupabaseRestBaseUrl|buildSupabaseRestHeaders|Supabase REST/,
    `${file} must not keep Supabase REST runtime dependencies after the VPS cutover`,
  );
}

const envExample = readFileSync('.env.vps.example', 'utf8');
assert.doesNotMatch(
  envExample,
  /SUPABASE_|VITE_SUPABASE|supabase\.co/i,
  '.env.vps.example must describe VPS-only environment variables',
);

console.log('VPS server Supabase REST removal static checks passed');
