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

  assert.match(
    source,
    /videoExistenceCache\.set\(videoCacheKey, \{ exists: true, url: cdnUrl, cachedAt: Date\.now\(\) \}\)/,
    `${file} should invalidate stale missing-video cache entries after a successful upload`
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

assert.match(
  card,
  /checkVideoBySku\(sku, \{ noCache: true \}\)/,
  'ProductCard should force a fresh video existence check after upload succeeds'
);

assert.match(
  card,
  /VIDEO_CONFIRMATION_RETRY_DELAYS_MS = \[0, 2000, 3000, 5000, 8000, 12000, 15000, 20000\]/,
  'ProductCard should wait for eventual Synology video listing after upload success'
);

assert.match(
  card,
  /waitForSynologyVideoConfirmation\(normalizedSku/,
  'ProductCard should retry video confirmation before falling back to pending success'
);

assert.doesNotMatch(
  card,
  /A VPS informou sucesso, mas o video ainda nao apareceu no Synology para este SKU/,
  'ProductCard should not show a hard failure when Synology listing is eventually consistent'
);

assert.match(
  card,
  /Video enviado; aguardando indexacao/,
  'ProductCard should show a pending-success state when Synology listing lags behind upload success'
);

console.log('synology video upload debug static checks passed');
