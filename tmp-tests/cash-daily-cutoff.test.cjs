'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cashSessionCutoff, cashOpeningAllowed } = require('../services/cashSessionCutoff.cjs');

test('the 20:00 Recife deadline belongs to the opening day', () => {
  const opened = '2026-10-30T12:00:00.000Z';
  assert.deepEqual(cashSessionCutoff(opened, '2026-10-30T22:59:59.999Z'), {
    requires_closing: false, cutoff_at: '2026-10-30T23:00:00.000Z',
  });
  assert.equal(cashSessionCutoff(opened, '2026-10-30T23:00:00.000Z').requires_closing, true);
  assert.equal(cashSessionCutoff(opened, '2026-10-31T13:00:00.000Z').requires_closing, true);
  assert.equal(cashOpeningAllowed('2026-10-30T22:59:59.999Z'), true);
  assert.equal(cashOpeningAllowed('2026-10-30T23:00:00.000Z'), false);
  assert.equal(cashOpeningAllowed('2026-10-31T03:00:00.000Z'), true);
});

test('a bad opening timestamp blocks the session', () => {
  assert.equal(cashSessionCutoff('invalid').requires_closing, true);
});

test('cash cutoff is enforced on server routes and visible in PDV', () => {
  const root = path.resolve(__dirname, '..');
  for (const filename of ['vps_server.cjs', 'vps_server.js']) {
    const code = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(code, /fastify\.post\('\/pdv\/cash-sessions\/open'[\s\S]*?cashOpeningAllowed\(\)/);
    assert.match(code, /if \(name === 'sales' && insertBody\.cash_session_id\)[\s\S]*?validateCashSessionForOperation/);
    assert.match(code, /fastify\.post\('\/pdv\/cash-sessions\/:id\/movements'[\s\S]*?cashSessionCutoff\(session\.opened_at\)/);
  }
  const serialized = fs.readFileSync(path.join(root, 'services/serializedSaleFinalization.cjs'), 'utf8');
  assert.match(serialized, /if \(sale\.cash_session_id\)[\s\S]*?cashSessionCutoff\(cashRows\[0\]\.opened_at\)/);
  const deploy = fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8');
  assert.match(deploy, /await upload\(path\.join\(__dirname, 'services\/cashSessionCutoff\.cjs'\)/);
  assert.match(deploy, /node --check \$\{appDir\}\/services\/cashSessionCutoff\.cjs/);
  const pdv = fs.readFileSync(path.join(root, 'pages/pdv/PDVPage.tsx'), 'utf8');
  assert.match(pdv, /activeCashSession\.requires_closing/);
  assert.match(pdv, /cashSession && !cashSession\.requires_closing/);
});
