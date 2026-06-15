import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/uploadService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /supabase\.storage|storage\.from\(/,
  'uploadService must not write or read Supabase Storage after the VPS/Synology migration',
);

assert.match(
  service,
  /VPS_DIRECT_BASE_URL/,
  'banner uploads should use the direct VPS base URL because the site proxy drops multipart files',
);

assert.match(
  service,
  /fetch\(`\$\{VPS_DIRECT_BASE_URL\}\/banners\/upload`/,
  'banner uploads should POST directly to the VPS banner endpoint',
);

assert.doesNotMatch(
  service,
  /vpsClient\.upload<[^>]+>\('\/banners\/upload'/,
  'banner uploads must not go through vpsClient.upload because production proxies multipart through /api/vps-proxy',
);

assert.match(
  service,
  /vpsClient\.upload<[^>]+>\('\/synology\/upload\?folder=imagens'/,
  'customer avatars should upload to Synology images through the VPS',
);

assert.doesNotMatch(
  service,
  /USE_VPS|config\/migration/,
  'uploadService should not keep a Supabase fallback flag for migrated storage',
);

console.log('upload service VPS/Synology static checks passed');
