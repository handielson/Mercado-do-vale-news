const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require('playwright');

test('callback no navegador troca código só uma vez e mantém a sessão MDV intacta', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Teste local</body></html>' }));
    await page.goto('https://3d.example.test');
    const code = ts.transpileModule(fs.readFileSync('services/print3dAccountClient.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    await page.evaluate(code => {
      sessionStorage.setItem('@mdv_vps_auth_session', 'mdv-unchanged');
      sessionStorage.setItem('print3d_google_browser_verifier', 'a'.repeat(64));
      window.sent = []; window.captchas = 0;
      window.fetch = async (url, init) => { window.sent.push({ url, ...init }); return { ok: true, json: async () => ({ token: '3d-only-token', customer: { id: '3d', name: 'Cliente', email: 'cliente@gmail.com' } }) }; };
      const exports = {};
      new Function('exports', 'require', code)(exports, path => path.includes('Turnstile') ? { print3dCaptchaToken: async () => { window.captchas++; return 'test-captcha'; } } : { buildVpsUrl: path => path });
      window.client = exports.print3dAccountClient;
    }, code);
    const result = await page.evaluate(async () => {
      const customers = await Promise.all([window.client.completeGoogle('b'.repeat(64)), window.client.completeGoogle('b'.repeat(64))]);
      return { customers, sent: window.sent, captchas: window.captchas, mdv: sessionStorage.getItem('@mdv_vps_auth_session'), own: sessionStorage.getItem('print3d_customer_session_v1'), proof: sessionStorage.getItem('print3d_google_browser_verifier') };
    });
    assert.equal(result.sent.length, 1); assert.equal(result.captchas, 1);
    assert.equal(result.sent[0].url, '/print3d/auth/google/exchange');
    assert.equal(result.sent[0].credentials, 'omit');
    assert.equal(JSON.parse(result.sent[0].body).browser_verifier, 'a'.repeat(64));
    assert.equal(result.mdv, 'mdv-unchanged'); assert.equal(result.own, '3d-only-token'); assert.equal(result.proof, null);
  } finally { await browser.close(); }
});
