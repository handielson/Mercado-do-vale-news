import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /BLING_TOKEN_REFRESH_BUFFER_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, `${file} must refresh Bling tokens five minutes early`);
  assert.match(source, /shouldRefreshBlingAccessTokenVps\(settings\)/, `${file} must use the preventive refresh guard`);
  assert.match(source, /isLikelyApplicationJwtVps\(request\.headers\.authorization\)/, `${file} must not forward the application JWT to Bling`);
  assert.doesNotMatch(source, /if \(request\.headers\.authorization\) return request\.headers\.authorization;/, `${file} must distinguish admin auth from Bling OAuth`);
}

console.log('Bling OAuth preventive refresh static checks ok');
