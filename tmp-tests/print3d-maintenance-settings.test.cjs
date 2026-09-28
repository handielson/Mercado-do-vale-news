'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_MESSAGE,
  present,
  validateInput,
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
  };
  registerPrint3dStorefrontSettingsRoutes(app, { pool: {}, getBearerAuthContext: async () => null });
  const publicRoute = routes.find(route => route.path === '/storefronts/loja_3d/settings');
  const adminGet = routes.find(route => route.method === 'GET' && route.path === '/admin/print3d/settings');
  const adminPut = routes.find(route => route.method === 'PUT' && route.path === '/admin/print3d/settings');
  assert.ok(publicRoute);
  assert.equal(publicRoute.options, null);
  assert.equal(typeof adminGet.options.preHandler, 'function');
  assert.equal(typeof adminPut.options.preHandler, 'function');
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
