import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const layout = readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
const models = readFileSync(new URL('../pages/admin/settings/ModelsPage.tsx', import.meta.url), 'utf8');

test('menu de modelos abre compacto e permite recuperar o menu completo', () => {
  assert.match(layout, /saved === null \? location\.pathname\.startsWith\('\/admin\/settings\/models'\)/);
  assert.match(layout, /localStorage\.setItem\('mdv-admin-sidebar-collapsed'/);
  assert.match(layout, /aria-label=\{sidebarCollapsed \? 'Expandir menu lateral' : 'Recolher menu lateral'\}/);
  assert.match(layout, /sidebarCollapsed \? "md:w-\[72px\] md:p-3" : "md:w-64"/);
  assert.match(layout, /aria-label=\{label\}/);
});

test('precos e acoes dos modelos nao sao comprimidos quando falta largura', () => {
  assert.match(layout, /flex-1 min-w-0 p-4/);
  assert.match(models, /overflow-auto max-h-\[65vh\]/);
  assert.match(models, /w-full min-w-\[1200px\] table-fixed/);
});
