'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_MESSAGE,
  present,
  validateInput,
  createMaintenancePreviewToken,
  verifyMaintenancePreviewToken,
  registerPrint3dStorefrontSettingsRoutes,
} = require('../services/print3dStorefrontSettingsServer.cjs');

test('public settings expose only the 3DMV maintenance state', () => {
  assert.deepEqual(present({ maintenance_mode: 1, maintenance_message: 'Voltamos amanhã.', updated_at: '2026-09-28' }), {
    storefront: 'loja_3d',
    maintenance_mode: true,
    maintenance_message: 'Voltamos amanhã.',
    updated_at: '2026-09-28',
  });
  assert.equal(present(null).maintenance_message, DEFAULT_MESSAGE);
});

test('maintenance update requires an explicit state and useful message', () => {
  assert.deepEqual(validateInput({ maintenance_mode: false, maintenance_message: 'Site aberto normalmente.' }), {
    maintenance_mode: false,
    maintenance_message: 'Site aberto normalmente.',
  });
  assert.throws(() => validateInput({ maintenance_mode: 'true', maintenance_message: 'Mensagem válida.' }), /ativada/);
  assert.throws(() => validateInput({ maintenance_mode: true, maintenance_message: 'curta' }), /10 e 500/);
});

test('registers separate public and authenticated admin routes', () => {
  const routes = [];
  const app = {
    get(path, options, handler) { routes.push({ method: 'GET', path, options: typeof options === 'function' ? null : options, handler: handler || options }); },
    put(path, options, handler) { routes.push({ method: 'PUT', path, options, handler }); },
    post(path, options, handler) { routes.push({ method: 'POST', path, options, handler }); },
  };
  registerPrint3dStorefrontSettingsRoutes(app, { pool: {}, getBearerAuthContext: async () => null, authSecret: 'test-secret' });
  const publicRoute = routes.find(route => route.path === '/storefronts/loja_3d/settings');
  const adminGet = routes.find(route => route.method === 'GET' && route.path === '/admin/print3d/settings');
  const adminPut = routes.find(route => route.method === 'PUT' && route.path === '/admin/print3d/settings');
  const adminPreview = routes.find(route => route.method === 'POST' && route.path === '/admin/print3d/settings/preview');
  const publicVerification = routes.find(route => route.method === 'POST' && route.path === '/storefronts/loja_3d/maintenance-preview/verify');
  assert.ok(publicRoute);
  assert.equal(publicRoute.options, null);
  assert.equal(typeof adminGet.options.preHandler, 'function');
  assert.equal(typeof adminPut.options.preHandler, 'function');
  assert.equal(typeof adminPreview.options.preHandler, 'function');
  assert.equal(publicVerification.options.preHandler, undefined);
});

test('administrative preview token is signed, expires and rejects tampering', () => {
  const now = 1_800_000_000;
  const preview = createMaintenancePreviewToken('test-secret', now);
  assert.equal(verifyMaintenancePreviewToken(preview.token, 'test-secret', now + 60).aud, 'print3d_maintenance_preview');
  assert.equal(verifyMaintenancePreviewToken(preview.token, 'test-secret', now + (2 * 60 * 60)), null);
  assert.equal(verifyMaintenancePreviewToken(`${preview.token.slice(0, -1)}x`, 'test-secret', now + 60), null);
  assert.equal(verifyMaintenancePreviewToken(preview.token, 'another-secret', now + 60), null);
});

test('public 3D surfaces use the 3DMV brand and the independent guard', () => {
  const root = path.resolve(__dirname, '..');
  const files = [
    'apps/print3d/index.html',
    'apps/print3d/main.tsx',
    'pages/store/Print3dStorePage.tsx',
    'pages/store/Print3dProductPage.tsx',
    'pages/store/Print3dAccountPage.tsx',
    'pages/store/Print3dAccountActionPage.tsx',
    'services/customerPhoneVerificationServer.cjs',
    'vps_server.js',
    'vps_server.cjs',
  ];
  const source = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /3D do Vale/);
  assert.match(source, /3DMV/);
  assert.match(fs.readFileSync(path.join(root, 'apps/print3d/main.tsx'), 'utf8'), /Print3dMaintenanceGuard/);
  assert.match(fs.readFileSync(path.join(root, 'routes/index.tsx'), 'utf8'), /Print3dMaintenanceGuard/);
  assert.match(fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8'), /services\/print3dStorefrontSettingsServer\.cjs/);
});

test('maintenance guard only bypasses after server verification and keeps a visible warning', () => {
  const root = path.resolve(__dirname, '..');
  const guard = fs.readFileSync(path.join(root, 'components/Print3dMaintenanceGuard.tsx'), 'utf8');
  const adminPage = fs.readFileSync(path.join(root, 'pages/admin/print3d/Print3dSettingsPage.tsx'), 'utf8');
  assert.match(guard, /verifyPreview\(candidate\.token\)/);
  assert.match(guard, /sessionStorage\.setItem\(PREVIEW_STORAGE_KEY/);
  assert.match(guard, /searchParams\.delete\('maintenance_preview'\)/);
  assert.match(guard, /o público continua vendo a página de manutenção/);
  assert.match(adminPage, /createPreview\(\)/);
  assert.match(adminPage, /new URL\('\/loja-3d', window\.location\.origin\)/);
  assert.match(adminPage, /Abrir prévia administrativa/);
});
