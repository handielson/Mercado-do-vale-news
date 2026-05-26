import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
const servers = ['vps_server.js', 'vps_server.cjs'].map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

for (const { file, source } of servers) {
  assert.match(
    source,
    /buildCopyableDebug\('synology-video-upload'/,
    `${file} should attach a copyable debug payload to upload status`
  );

  assert.match(
    source,
    /step: 'synology_(request|rejected|exception)'/,
    `${file} debug should identify the failing stage`
  );

  assert.match(
    source,
    /synologyError/,
    `${file} debug should include DSM error details when Synology rejects the upload`
  );

  assert.doesNotMatch(
    source,
    /buildCopyableDebug\('synology-video-upload'[\s\S]{0,500}(SYNO_PASS|_sid|Authorization|x-sync-key|access_token|refresh_token|password)/i,
    `${file} debug must not expose secrets or session ids`
  );
}

assert.match(
  card,
  /class SynologyUploadError extends Error/,
  'ProductCard should preserve upload debug through thrown errors'
);

assert.match(
  card,
  /Copiar debug/,
  'ProductCard should render a copy debug action for failed video uploads'
);

assert.match(
  card,
  /navigator\.clipboard\.writeText\(debugText\)/,
  'ProductCard should copy the structured upload debug payload'
);

console.log('synology video upload debug static checks passed');
