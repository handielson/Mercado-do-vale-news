import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const pagePath = resolve(root, 'pages', 'admin', 'settings', 'DisplaysPage.tsx');
const routesPath = resolve(root, 'routes', 'index.tsx');
const layoutPath = resolve(root, 'layouts', 'AdminLayout.tsx');
const planPath = resolve(root, 'docs', 'planos', 'android.md');

assert.ok(existsSync(pagePath), 'pages/admin/settings/DisplaysPage.tsx deve existir');

const page = readFileSync(pagePath, 'utf8');
const routes = readFileSync(routesPath, 'utf8');
const layout = readFileSync(layoutPath, 'utf8');
const plan = readFileSync(planPath, 'utf8');

for (const expected of [
  'pdvDisplayService.listDisplays',
  'pdvDisplayService.createDisplay',
  'pdvDisplayService.updateDisplay',
  'pdvDisplayService.generatePairingCode',
  'pdvDisplayService.revokeDisplayToken',
  'pdvDisplayService.deleteDisplay',
  'pdvDisplayService.cleanupTrash',
  'showStoreName',
  'showPixAmount',
  'showItems',
  'showInstructions',
  'showAdsDuringPix',
  'adRotationSeconds',
  'Abrir tela de pareamento',
  'href="/display"',
  'target="_blank"',
  "value=\"cashier\"",
  "value=\"ads\"",
  "value=\"hybrid\"",
  "value=\"portrait\"",
  "value=\"landscape\"",
  'window.confirm',
]) {
  assert.ok(page.includes(expected), `DisplaysPage.tsx deve conter ${expected}`);
}

assert.ok(routes.includes("const DisplaysPage = lazy(() => import('../pages/admin/settings/DisplaysPage'))"), 'rota deve lazy-load DisplaysPage');
assert.ok(routes.includes('path: "/admin/settings/displays"'), 'rota /admin/settings/displays deve existir');
assert.ok(routes.includes('<AdminLayout><DisplaysPage /></AdminLayout>'), 'rota deve renderizar DisplaysPage no AdminLayout');
assert.ok(layout.includes("to: '/admin/settings/displays'"), 'menu deve apontar para /admin/settings/displays');
assert.ok(layout.includes("label: 'Displays Android'"), 'menu deve exibir Displays Android');
assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 3 Admin De Displays Android'), 'android.md deve registrar o bloco Fase 3');

console.log('pdv display admin static checks passed');
