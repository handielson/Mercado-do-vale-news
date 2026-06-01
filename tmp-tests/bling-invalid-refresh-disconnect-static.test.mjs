import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/blingService.ts', 'utf8');
const page = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');

assert.match(
  service,
  /async function clearStoredBlingConnection\(\)/,
  'blingService must centralize clearing invalid stored Bling tokens',
);

assert.match(
  service,
  /bling_access_token:\s*null[\s\S]*bling_refresh_token:\s*null[\s\S]*bling_token_expires_at:\s*null/,
  'invalid Bling refresh must clear access token, refresh token, and expiry in VPS company settings',
);

assert.match(
  service,
  /if\s*\(!res\.ok\)\s*\{[\s\S]*clearStoredBlingConnection\(\)/,
  'refreshToken must clear the stale Bling connection when the refresh token is rejected',
);

assert.match(
  page,
  /isBlingReconnectRequired\(err\)[\s\S]*setIsConnected\(false\)[\s\S]*setTokenExpiresAt\(null\)/,
  'BlingPage must switch to disconnected state after an invalid refresh error',
);

console.log('Bling invalid refresh disconnect static checks ok');
