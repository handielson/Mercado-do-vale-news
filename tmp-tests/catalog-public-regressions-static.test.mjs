import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const normalizer = readFileSync('services/productNormalizer.ts', 'utf8');
assert.match(
  normalizer,
  /function\s+normalizeTrackInventory/,
  'productNormalizer must normalize track_inventory values instead of relying on Boolean()',
);
assert.doesNotMatch(
  normalizer,
  /track_inventory\s*=\s*Boolean\(p\.track_inventory\)/,
  'track_inventory string values like "0" must not become true',
);
assert.match(
  normalizer,
  /['"]0['"].*false|false.*['"]0['"]/s,
  'track_inventory normalization must treat "0" as false',
);

const catalogSections = readFileSync('services/catalogSectionsService.ts', 'utf8');
assert(
  Number(catalogSections.match(/CACHE_KEY_PREFIX\s*=\s*['"]@mv:section_products:v(\d+):/)?.[1]) >= 5,
  'catalog section cache prefix must be bumped after visibility normalization changes',
);
