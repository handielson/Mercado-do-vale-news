import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import tailwind from 'tailwindcss';
import postcss from 'postcss';

const layout = readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
const models = readFileSync(new URL('../pages/admin/settings/ModelsPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('menu lateral oculta a barra visual sem bloquear a rolagem', () => {
  assert.match(layout, /admin-sidebar-scroll[^"\n]*overflow-y-auto/);
  assert.match(layout, /<nav aria-label="Menu administrativo" className=\{cn\("admin-sidebar-scroll[^"\n]*overflow-y-auto/);
  assert.match(css, /\.admin-sidebar-scroll\s*\{[^}]*scrollbar-width:\s*none/s);
  assert.match(css, /\.admin-sidebar-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
});

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

test('Tailwind gera as classes de largura e flexibilidade do menu compacto', async () => {
  const { default: config } = await import('../tailwind.config.js');
  const result = await postcss([tailwind(config)]).process('@tailwind utilities;', { from: undefined });
  const rule = selector => {
    const start = result.css.indexOf(selector);
    assert.ok(start >= 0, `regra ${selector} ausente no CSS gerado`);
    return result.css.slice(start, result.css.indexOf('}', start));
  };
  assert.match(rule(String.raw`.md\:w-\[72px\]`), /width:\s*72px/);
  assert.match(rule(String.raw`.md\:flex-none`), /flex:\s*none/);
});
