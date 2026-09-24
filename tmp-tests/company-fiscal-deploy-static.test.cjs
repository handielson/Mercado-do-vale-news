const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('deploy fiscal registra a rota no entrypoint real do PM2', () => {
  const source = fs.readFileSync(require.resolve('../deploy-vps-server-only.cjs'), 'utf8');
  for (const file of ['fiscalCancellationCore.cjs','fiscalCancellationSefaz.cjs','fiscalCancellationAutomation.cjs']) {
    assert(source.includes(`'services/${file}'`), `Deploy deve copiar ${file}`);
  }
  assert.match(source, /require\.resolve\('xml-crypto'\)/);
  assert.match(source, /require\.resolve\('@xmldom\/xmldom'\)/);
  assert.match(source, /\['server\.js','vps_server\.js','vps_server\.cjs'\]/);
  assert.match(source, /--company-fiscal-only/);
  assert.match(source, /applyCompanyFiscalMigration/);
});
