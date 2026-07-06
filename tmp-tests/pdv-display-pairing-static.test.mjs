import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const pagePath = resolve(root, 'pages', 'display', 'DisplayPage.tsx');
const adminPagePath = resolve(root, 'pages', 'admin', 'settings', 'DisplaysPage.tsx');
const displayTypesPath = resolve(root, 'types', 'pdvDisplay.ts');
const routesPath = resolve(root, 'routes', 'index.tsx');
const planPath = resolve(root, 'docs', 'planos', 'android.md');

assert.ok(existsSync(pagePath), 'pages/display/DisplayPage.tsx deve existir');

const page = readFileSync(pagePath, 'utf8');
const adminPage = readFileSync(adminPagePath, 'utf8');
const displayTypes = readFileSync(displayTypesPath, 'utf8');
const routes = readFileSync(routesPath, 'utf8');
const plan = readFileSync(planPath, 'utf8');

for (const expected of [
  'PDV_DISPLAY_TOKEN_STORAGE_KEY',
  'localStorage.getItem(PDV_DISPLAY_TOKEN_STORAGE_KEY)',
  'localStorage.setItem(PDV_DISPLAY_TOKEN_STORAGE_KEY',
  'localStorage.removeItem(PDV_DISPLAY_TOKEN_STORAGE_KEY)',
  'isRevokedDisplayTokenError',
  'pdvDisplayService.pairDisplay',
  'pdvDisplayService.getDisplayState',
  'setInterval',
  'clearInterval',
  'Token revogado',
  'Codigo de pareamento',
  'active_pix',
  'qr_code_base64',
  'qr_code',
  'showPixAmount',
  'showInstructions',
  'idle_content',
]) {
  assert.ok(page.includes(expected), `DisplayPage.tsx deve conter ${expected}`);
}

for (const expected of ['showItems', 'showAdsDuringPix']) {
  assert.ok(adminPage.includes(expected), `DisplaysPage.tsx deve conter ${expected}`);
  assert.ok(displayTypes.includes(expected), `pdvDisplay.ts deve conter ${expected}`);
}

assert.ok(routes.includes("const DisplayPage = lazy(() => import('../pages/display/DisplayPage'))"), 'rota deve lazy-load DisplayPage');
assert.ok(routes.includes('path: "/display"'), 'rota /display deve existir');
assert.ok(routes.includes('element: <DisplayPage />'), 'rota /display deve renderizar DisplayPage sem ProtectedRoute');
assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 4 Pagina Publica Android'), 'android.md deve registrar o bloco Fase 4');

assert.match(
  page,
  /if \(isRevokedDisplayTokenError\(message\)\)/,
  'Display must only clear the saved pairing token for explicit revoked/invalid token errors'
);

assert.doesNotMatch(
  page,
  /message\.toLowerCase\(\)\.includes\('token'\)/,
  'Display must not clear pairing on any transient error just because the request URL contains token='
);

console.log('pdv display pairing static checks passed');
