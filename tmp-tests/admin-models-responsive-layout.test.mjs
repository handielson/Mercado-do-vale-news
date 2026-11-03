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
  // 02/11/2026: sem caixa de rolagem vertical (max-h); a rolagem lateral continua quando falta largura.
  assert.match(models, /shadow-sm overflow-x-auto" data-models-table/);
  // models-table-fit-1100-v1: com menu lateral aberto em tela de 1536px sobram ~1160px; a tabela precisa caber
  // sem rolagem, senao a coluna fixa de Acoes cobre o Status.
  assert.match(models, /w-full min-w-\[1100px\] table-fixed/);
  assert.match(models, /<col className="w-14" \/><col className="w-24" \/><col className="w-40" \/>/);
  assert.match(models, /h-7 w-full min-w-0 text-xs py-1 pl-8 pr-1\.5/, 'precos de 4 digitos (R$ 1.199,00) cabem no campo');
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
