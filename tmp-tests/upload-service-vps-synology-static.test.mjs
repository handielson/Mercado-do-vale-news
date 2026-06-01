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
  /vpsClient\.upload<\{\s*url:\s*string\s*\}>\('\/banners\/upload'/,
  'banner uploads should stay on the VPS banner endpoint',
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
