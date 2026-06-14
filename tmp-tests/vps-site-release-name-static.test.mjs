import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/deploy-vps-site.cjs', 'utf8');

assert.match(
  source,
  /process\.env\.VPS_SITE_RELEASE_NAME/,
  'deploy do site deve aceitar nome de release fixo para registrar versao antes de publicar'
);

assert.match(
  source,
  /\^\[0-9\]\{8\}-\[0-9\]\{6\}/,
  'nome fixo da release deve validar formato YYYYMMDD-HHMMSS'
);

assert.match(
  source,
  /return configuredReleaseName;/,
  'deploy deve usar a release configurada quando fornecida'
);

console.log('vps-site-release-name-static ok');
