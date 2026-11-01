const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const deploy = require('../scripts/deploy-fiscal-tax-profiles.cjs');

test('deploy completo leva os arquivos novos, cria data/fiscal e aplica a migration 028', () => {
  const source = fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8');
  for (const file of [...deploy.modules, ...deploy.dataFiles]) assert.ok(source.includes(`'${file}'`), file);
  assert.equal(source.split("'migrations/028_fiscal_tax_profiles.sql'").length - 1, 2);
  assert.ok(source.includes("'company_fiscal_tax_profiles','product_fiscal_settings'"));
  assert.ok((source.match(/mkdir -p \$\{appDir\}\/data\/fiscal|\$\{appDir\}\/data\/fiscal`\)/g) || []).length >= 2);
  assert.match(source, /--fiscal-tax-profiles-only/); assert.match(source, /--fiscal-tax-profiles-check/);
});
test('arquivos do deploy existem e a migration não tem ponto e vírgula em comentário', () => {
  for (const file of [...deploy.modules, ...deploy.dataFiles, deploy.portal, deploy.migration]) assert.ok(fs.existsSync(path.join(root, file)), file);
  const sql = fs.readFileSync(path.join(root, deploy.migration), 'utf8');
  assert.ok(sql.split('\n').filter(l => l.trim().startsWith('--')).every(l => !l.includes(';')));
});
test('trava de divergência: portal local sem o gancho = HEAD publicado', () => {
  const { withoutHook, withHook } = deploy.expectedRemotePortalHash(root);
  assert.notEqual(withoutHook, withHook);
});
test('deploy recusa alvo errado', async () => {
  await assert.rejects(deploy.deployFiscalTaxProfiles({ appDir: '/x', apiProc: { name: 'mdv-api' } }), /target/);
});
