const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
test('selective refresh deployment preserves unrelated remote code and rejects drift', () => {
  const { patchEntry, refreshBlock, BASELINE } = require('../scripts/deploy-bling-refresh-safe.cjs');
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const before = require('node:child_process').execFileSync('git', ['show', BASELINE + ':' + file], { encoding: 'utf8', maxBuffer: 15e6 });
    const after = fs.readFileSync(file, 'utf8');
    const remote = '// remote customization\n' + before;
    const updated = patchEntry(remote, before, after);
    assert.equal(refreshBlock(updated), refreshBlock(after));
    assert.equal(updated.replace(refreshBlock(updated).replace(/\n/g, remote.includes('\r\n') ? '\r\n' : '\n'), ''), remote.replace(refreshBlock(before).replace(/\n/g, remote.includes('\r\n') ? '\r\n' : '\n'), ''));
    assert.equal(patchEntry(updated, before, after), updated);
    assert.throws(() => patchEntry(before.replace("return settings?.bling_access_token || '';", "return 'drift';"), before, after), /drift/);
  }
});

// Execute each real API entry handler with an isolated provider and DB.
for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const handler = ast.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === 'refreshBlingStoredAccessTokenVps');
  assert.ok(handler, `${file}: refresh handler must exist`);
  function fixture({ status = 200, data = { access_token: 'fixture-new', refresh_token: 'fixture-rotated', expires_in: 3600 }, networkError, saveError } = {}) {
    const writes = [], requests = [];
    const settings = { id: 'fixture-id', bling_access_token: 'fixture-old', bling_refresh_token: 'fixture-refresh',
      bling_client_id: 'fixture-client', bling_client_secret: 'fixture-secret' };
    const context = vm.createContext({ URLSearchParams,
      requestBlingToken: async (...args) => {
        requests.push(args); if (networkError) throw networkError;
        return { response: { ok: status >= 200 && status < 300, status }, data };
      },
      vpsDbPatch: async (...args) => { if (saveError) throw saveError; writes.push(args); },
    });
    vm.runInContext(handler.getText(ast), context);
    return { run: () => context.refreshBlingStoredAccessTokenVps(settings), settings, writes, requests };
  }
  for (const status of [429, 500, 503, 401]) {
    test(`${file}: HTTP ${status} never returns old credentials or writes them`, async () => {
      const f = fixture({ status, data: { error: { type: 'fixture-provider-error' } } });
      await assert.rejects(f.run());
      assert.equal(f.writes.length, 0);
      assert.equal(f.settings.bling_access_token, 'fixture-old');
    });
  }
  test(`${file}: missing refresh configuration requires reconnection without a request`, async () => {
    const f = fixture(); delete f.settings.bling_refresh_token;
    await assert.rejects(f.run(), /[Rr]econect/);
    assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
  });
  test(`${file}: network failure preserves credentials and rejects`, async () => {
    const f = fixture({ networkError: new Error('network unavailable') });
    await assert.rejects(f.run(), /network unavailable/); assert.equal(f.writes.length, 0);
  });
  for (const data of [{}, { access_token: ' ' }, { access_token: 42 }, { access_token: 'fixture-new', expires_in: 'invalid' }, { access_token: 'fixture-new', expires_in: -1 }]) {
    test(`${file}: malformed provider success never saves or returns a token (${JSON.stringify(data)})`, async () => {
      const f = fixture({ data }); await assert.rejects(f.run()); assert.equal(f.writes.length, 0);
    });
  }
  test(`${file}: successful refresh persists rotated tokens and valid expiry`, async () => {
    const f = fixture(); assert.equal(await f.run(), 'fixture-new'); assert.equal(f.writes.length, 1);
    const [table, query, saved] = f.writes[0];
    assert.equal(table, 'company_settings'); assert.equal(query, 'id=eq.fixture-id');
    assert.equal(saved.bling_refresh_token, 'fixture-rotated');
    assert.ok(new Date(saved.bling_token_expires_at).getTime() > Date.now());
    assert.equal(f.requests[0][0].get('grant_type'), 'refresh_token');
  });
  test(`${file}: provider without a new refresh token retains the current refresh token`, async () => {
    const f = fixture({ data: { access_token: 'fixture-new', expires_in: 3600 } });
    assert.equal(await f.run(), 'fixture-new'); assert.equal(f.writes[0][2].bling_refresh_token, 'fixture-refresh');
  });
  test(`${file}: failed persistence never reports successful refresh`, async () => {
    const f = fixture({ saveError: new Error('save failed') }); await assert.rejects(f.run(), /save failed/);
  });
}
