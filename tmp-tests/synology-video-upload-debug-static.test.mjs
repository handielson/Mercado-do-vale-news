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

  assert.match(
    source,
    /function getSynologyRequestPort\(urlObj\)[\s\S]*urlObj\.protocol === 'https:' \? 443 : 80/,
    `${file} should use the SYNOLOGY_URL protocol default port instead of forcing DSM port 5001`
  );

  assert.match(
    source,
    /function describeSynologyErrorCode\(code\)[\s\S]*119: 'SID not found'/,
    `${file} should translate DSM code 119 in upload debug output`
  );

  assert.match(
    source,
    /const uploadPath = `\/webapi\/entry\.cgi\?_sid=\$\{encodeURIComponent\(sid\)\}`/,
    `${file} should pass the Synology SID in the upload endpoint query string`
  );

  assert.match(
    source,
    /path: uploadPath, method: 'POST'/,
    `${file} should use the upload path containing the SID for video uploads`
  );

  assert.doesNotMatch(
    source,
    /parseInt\(urlObj\.port\)\s*\|\|\s*5001/,
    `${file} should not force port 5001 when SYNOLOGY_URL is an HTTPS tunnel without explicit port`
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
