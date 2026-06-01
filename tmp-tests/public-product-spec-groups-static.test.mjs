import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /id: 'logistica'[\s\S]*label: 'Logística'/,
  'public product specs must have a dedicated logistics group'
);

assert.match(
  source,
  /keys: \[[^\]]*'dimensions\.width_cm'[^\]]*'dimensions\.height_cm'[^\]]*'dimensions\.depth_cm'/,
  'dimension fields must be assigned to logistics, not other characteristics'
);

assert.match(
  source,
  /function resolveSpecGroupId/,
  'public product specs must classify compatible fields instead of relying only on exact keys'
);

assert.match(
  source,
  /normalized\.includes\('camera'\)/,
  'camera-like fields such as camera traseira video must go to cameras'
);

assert.doesNotMatch(
  source,
  /keys: \['celular_biometria', 'resistencia', 'peso_g'\]/,
  'peso_g must not remain bundled with physical/security when logistics exists'
);
