import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../services/blingService.ts', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ buildVpsUrl, getVpsSyncHeaders, VPS_DIRECT_BASE_URL \} from '\.\/vpsProxyBase';/,
  'blingService must use the shared VPS transport helpers',
);

assert.match(
  source,
  /async function materializeBlingImagesToVps\(/,
  'bling imports must materialize remote images through the VPS',
);

assert.match(
  source,
  /resource=image-proxy&url=/,
  'orgbling images must be fetched through the existing safe image proxy',
);

assert.match(
  source,
  /buildVpsUrl\('\/images\/upload', \{ method: 'POST' \}\)/,
  'materialized images must be uploaded to the VPS image bank',
);

assert.match(
  source,
  /row\.images = await materializeBlingImagesToVps\(/,
  'bulk Bling imports must upload images before persisting product rows',
);

assert.match(
  source,
  /const processedImages = await materializeBlingImagesToVps\(/,
  'Bling reimport must upload refreshed images before persisting product rows',
);

assert.doesNotMatch(
  source,
  /row\.images = normalizeExternalImageUrls\(Array\.isArray\(row\.images\) \? row\.images : \[\]\);/,
  'bulk imports must not save raw Bling image URLs directly',
);

console.log('bling-import-vps-images ok');
