const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('deploy fiscal registra a rota no entrypoint real do PM2', () => {
  const source = fs.readFileSync(require.resolve('../deploy-vps-server-only.cjs'), 'utf8');
  assert.match(source, /\['server\.js','vps_server\.js','vps_server\.cjs'\]/);
  assert.match(source, /--company-fiscal-only/);
  assert.match(source, /applyCompanyFiscalMigration/);
});
