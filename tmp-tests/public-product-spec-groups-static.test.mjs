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

assert.match(
  source,
  /keys: \[[^\]]*'camera_ultrawide_mpx'[^\]]*'camera_macro_mpx'[^\]]*'camera_depth_mpx'[^\]]*'camera_teleobjetiva_mpx'/,
  'new smartphone camera fields must be listed in the camera group'
);

assert.match(
  source,
  /keys: \[[^\]]*'processador'[^\]]*'cpu'[^\]]*'gpu'[^\]]*'chipset'[^\]]*'antutu'[^\]]*'litografia_nm'/,
  'processor and benchmark fields must stay grouped under processing'
);

assert.match(
  source,
  /keys: \[[^\]]*'taxa_atualizacao_hz'[^\]]*'brilho_nits'[^\]]*'resolucao_tela'/,
  'display refresh, brightness and resolution fields must stay grouped under screen'
);

assert.match(
  source,
  /keys: \[[^\]]*'irda'[^\]]*'gps'[^\]]*'bluetooth'[^\]]*'wifi'[^\]]*'usb'/,
  'connectivity fields such as IrDA, GPS, Bluetooth, Wi-Fi and USB must stay grouped together'
);

assert.match(
  source,
  /normalized\.includes\('megapixel'\)[\s\S]*return 'camera'/,
  'camera grouping must classify newly named megapixel fields even when the exact key is unknown'
);

assert.match(
  source,
  /normalized\.includes\('snapdragon'\)[\s\S]*return 'desempenho'/,
  'processing grouping must classify chipset family fields even when the exact key is unknown'
);

assert.doesNotMatch(
  source,
  /keys: \['celular_biometria', 'resistencia', 'peso_g'\]/,
  'peso_g must not remain bundled with physical/security when logistics exists'
);
