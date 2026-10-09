const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const fastifyFactory = require('fastify');
const { BOT_FIELDS, companySettingsReadSql, selectBotCompanySettings } = require('../services/companySettingsBotView.cjs');
const { settingsBlock, patchEntry, BASELINE, ENTRIES } = require('../scripts/deploy-company-settings-bot.cjs');
const source = fs.readFileSync('server.js', 'utf8');
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
const fixture = {
  ...Object.fromEntries(BOT_FIELDS.map(field => [field, null])),
  name: 'Loja Teste', address_street: 'Rua Teste', address_number: '123',
  business_hours: JSON.stringify({ friday: { isOpen: true, openTime: '08:00', closeTime: '18:00' } }),
  pix_key: 'fixture-key', pix_beneficiary_name: 'Fixture',
  logo: 'data:image/png;base64,' + 'A'.repeat(200000),
  favicon: 'data:image/png;base64,' + 'B'.repeat(200000), watermark_url: 'data:image/png;base64,' + 'C'.repeat(200000),
  bling_access_token: 'test-secret', shopee_partner_key: 'test-secret',
};
assert.equal(selectBotCompanySettings(null), null);
assert.deepEqual(selectBotCompanySettings({ name: 'Loja', secret: 'no' }), { name: 'Loja' });
assert.equal(companySettingsReadSql(undefined), 'SELECT * FROM company_settings LIMIT 1');
assert.equal(companySettingsReadSql("bot'; DROP TABLE x"), companySettingsReadSql(undefined));
assert.doesNotMatch(companySettingsReadSql('bot'), /SELECT \*|logo|favicon|watermark|token|secret|partner_key/);
async function exercise(block, leanExpected) {
  const app = fastifyFactory(); let row = fixture; const queries = [];
  const context = {
    fastify: app, require: () => ({ companySettingsReadSql, selectBotCompanySettings }),
    pool: { query: async sql => {
      queries.push(sql);
      return [[row === null ? undefined : sql.includes('SELECT *') ? row : selectBotCompanySettings(row)]];
    } },
    requireSyncKey: async (req, reply) => { if (req.headers['x-sync-key'] !== 'fixture') return reply.code(401).send({ error: 'Unauthorized' }); },
    redactTikTokShopSecretsFromCompanySettingsVps: row => row,
    crypto: require('node:crypto'),
  };
  vm.createContext(context);
  for (const name of ['parsePublicJson', 'buildPublicCompanyAddress', 'sha256Hex', 'sanitizePublicCompanySettings']) vm.runInContext(functionSource(name), context);
  vm.runInContext(block, context);
  try {
    const denied = await app.inject('/company-settings?view=bot'); assert.equal(denied.statusCode, 401);
    const full = await app.inject({ url: '/company-settings', headers: { 'x-sync-key': 'fixture' } });
    assert.equal(full.statusCode, 200); assert.equal(full.json().logo, fixture.logo);
    const lean = await app.inject({ url: '/company-settings?view=bot', headers: { 'x-sync-key': 'fixture' } });
    const data = lean.json(); assert.equal(lean.statusCode, 200);
    assert.equal(data.business_hours, fixture.business_hours); assert.equal(data.pix_key, fixture.pix_key);
    if (leanExpected) {
      assert.deepEqual(Object.keys(data).sort(), [...BOT_FIELDS].sort());
      assert.ok(lean.rawPayload.length < full.rawPayload.length / 100);
      assert.doesNotMatch(queries.at(-1), /SELECT \*|logo|token/);
    } else assert.ok(data.logo, 'Baseline proves the old handler loads unnecessary media');
    const publicFull = await app.inject('/public/company-settings');
    const publicLean = await app.inject('/public/company-settings?view=bot');
    assert.equal(publicLean.statusCode, 200);
    assert.deepEqual(publicLean.json().business_hours, publicFull.json().business_hours);
    assert.equal(publicLean.json().address, publicFull.json().address);
    assert.ok(!('pix_key' in publicLean.json())); assert.ok(!('bling_access_token' in publicLean.json()));
    if (leanExpected) {
      assert.ok(!('logo' in publicLean.json()));
      assert.ok(Object.keys(publicLean.json()).every(key => BOT_FIELDS.includes(key)));
    }
    row = null;
    const empty = await app.inject({ url: '/company-settings?view=bot', headers: { 'x-sync-key': 'fixture' } });
    assert.equal(empty.json(), null);
  } finally { await app.close(); }
}
(async () => {
  for (const file of ENTRIES) {
    const current = fs.readFileSync(file, 'utf8');
    const before = execFileSync('git', ['show', BASELINE + ':' + file], { encoding: 'utf8', maxBuffer: 15e6 });
    const patched = patchEntry(before, current, before);
    assert.equal(settingsBlock(patched), settingsBlock(current));
    assert.equal(patchEntry(patched, current, before), patched);
    assert.equal(patched.replace(settingsBlock(current), settingsBlock(before)).replace(/\r\n/g, '\n'), before.replace(/\r\n/g, '\n'));
    const drifted = before.replace(settingsBlock(before), settingsBlock(before).replace('no-store', 'private'));
    assert.throws(() => patchEntry(drifted, current, before), /drift/);
    await exercise(settingsBlock(current), true);
  }
  const before = execFileSync('git', ['show', BASELINE + ':server.js'], { encoding: 'utf8', maxBuffer: 15e6 });
  await exercise(settingsBlock(before), false);
  console.log('Company settings bot view: SQL projection, actual routes, public sanitization, baseline and selective deployment passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
