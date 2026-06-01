import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/vpsClient.ts', 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'vpsClient must not statically import the Supabase client, because public VPS reads should not require Supabase env vars',
);

assert.match(
  source,
  /from ['"]\.\/authSession['"]/,
  'vpsClient should read first-party VPS auth tokens through authSession',
);

assert.match(
  source,
  /getAuthSessionToken/,
  'vpsClient should isolate optional session lookup in authSession',
);

assert.match(
  source,
  /const token = await getAuthSessionToken\(\);/,
  'buildHeaders should attach Authorization from the lazy session helper',
);

assert.match(
  source,
  /getAuthSessionToken\(\)\.then\(\(token\) =>/,
  'uploadWithProgress should also use the lazy session helper',
);

console.log('vpsClient authSession static checks passed');
