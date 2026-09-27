const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(enabled, token) {
  const source = fs.readFileSync('services/customerAuthCaptcha.ts', 'utf8')
    .replace("import.meta.env.VITE_MDV_AUTH_SECURITY_ENABLED", JSON.stringify(enabled))
    .replace("import.meta.env.VITE_MDV_TURNSTILE_SITE_KEY", "'mdv-test-sitekey'");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = {}; new Function('exports', 'require', code)(result, () => ({ storefrontCaptchaToken: token }));
  return result.protectAuthRequest;
}
test('cliente MDV usa chave/ação próprias e preserva credenciais; falha não prossegue', async () => {
  const calls = [];
  const protect = load('1', async (...args) => { calls.push(args); return 'fresh-token'; });
  const input = { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ password: 'test', email: 'test@example.test' }) };
  const output = await protect('/auth/login', input);
  assert.deepEqual(calls, [['mdv-test-sitekey', 'mdv_auth']]);
  assert.equal(output.headers, input.headers);
  assert.deepEqual(JSON.parse(output.body), { password: 'test', email: 'test@example.test', captcha_token: 'fresh-token' });
  assert.equal(await protect('/auth/me', { method: 'GET' }).then(x => x.method), 'GET');
  assert.equal(await protect('/auth/google/callback', input), input);
  assert.equal(await protect('/print3d/auth/login', input), input);
  assert.equal(calls.length, 1);
  const fail = load('1', async () => { throw new Error('CAPTCHA unavailable'); });
  await assert.rejects(fail('/auth/password-reset/request', input), /unavailable/);
  const disabled = load('0', async () => { throw new Error('must not load captcha'); });
  assert.equal(await disabled('/auth/login', input), input);
});
