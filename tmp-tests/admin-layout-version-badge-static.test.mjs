import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(
  source,
  /fetch\('\/VERSION\.json'/,
  'AdminLayout deve buscar a versao publica em /VERSION.json'
);

assert.match(
  source,
  /appVersion\?\.version/,
  'AdminLayout deve renderizar a versao no menu lateral'
);

assert.match(
  source,
  /title=\{appVersionTooltip\}/,
  'Badge de versao deve mostrar detalhes ao passar o mouse'
);

console.log('admin-layout-version-badge-static ok');
