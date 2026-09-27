const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require('playwright');

test('navegador: CAPTCHA novo por POST, cancelamento impede envio e GET não exige desafio', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Teste local de segurança 3D</title><body></body></html>' }));
    await page.goto('http://print3d.local.test');
    const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replace('import.meta.env.VITE_PRINT3D_TURNSTILE_SITE_KEY', "'test-site-key'"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await page.evaluate(({ captcha, client }) => {
      window.sent = []; window.removed = []; window.options = [];
      window.turnstile = {
        render(container, options) { window.options.push(options); container.textContent = 'Desafio simulado para teste local'; return String(window.options.length); },
        remove(id) { window.removed.push(id); },
      };
      window.fetch = async (url, init) => { window.sent.push({ url, ...init }); return { ok: true, json: async () => ({ message: 'ok' }) }; };
      const captchaExports = {}; new Function('exports', captcha)(captchaExports);
      const clientExports = {};
      new Function('exports', 'require', client)(clientExports, path => path.includes('Turnstile') ? captchaExports : { buildVpsUrl: path => path });
      window.client = clientExports.print3dAccountClient;
      window.start = () => { window.pending = window.client.registerEmail('Teste', 'test@example.test', 'test-password').then(() => 'ok', error => error.message); };
    }, { captcha: compile('services/print3dTurnstile.ts'), client: compile('services/print3dAccountClient.ts') });
    await page.evaluate(() => window.start());
    await page.getByRole('dialog', { name: 'Verificação de segurança' }).waitFor();
    assert.equal(await page.evaluate(() => window.sent.length), 0);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    assert.match(await page.evaluate(() => window.pending), /não concluída/);
    assert.equal(await page.evaluate(() => window.sent.length), 0);
    for (const token of ['fresh-one', 'fresh-two']) {
      await page.evaluate(() => window.start());
      await page.getByRole('dialog').waitFor();
      await page.evaluate(token => window.options.at(-1).callback(token), token);
      assert.equal(await page.evaluate(() => window.pending), 'ok');
    }
    const sent = await page.evaluate(() => window.sent);
    assert.deepEqual(sent.map(item => JSON.parse(item.body).captcha_token), ['fresh-one', 'fresh-two']);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.evaluate(() => window.removed.length), 3);
    await page.evaluate(() => window.client.phoneStatus());
    assert.equal(await page.evaluate(() => window.options.length), 3);
    assert.equal(await page.evaluate(() => window.sent.at(-1).method), 'GET');
  } finally { await browser.close(); }
});
