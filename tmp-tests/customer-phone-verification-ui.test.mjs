// Local browser regression: all API traffic is mocked; never sends WhatsApp or creates a customer.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PHONE_TEST_BASE_URL || 'http://127.0.0.1:5175';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Use a local test server');
const browser = await chromium.launch({ headless: true, channel: process.env.PHONE_TEST_BROWSER || 'msedge' });
try {
  const page = await browser.newPage();
  const errors = [];
  let sends = 0;
  let registrations = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.searchParams.get('path') || url.pathname);
    if (path.includes('/auth/phone/request')) {
      sends++;
      return route.fulfill({ json: { challenge_id: 'a'.repeat(48), retry_after: 60, expires_in: 600 } });
    }
    if (path.includes('/auth/phone/verify')) {
      return route.fulfill({ json: { phone_verification_token: 'b'.repeat(64), expires_in: 600 } });
    }
    if (path.includes('/auth/register')) { registrations++; return route.fulfill({ status: 400, json: { error: 'Mock: no registration' } }); }
    if (url.origin !== base || url.pathname.startsWith('/api/')) return route.fulfill({ json: [] });
    return route.continue();
  });
  await page.goto(base + '/cliente/cadastro');
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor();
  assert.equal(await submit.isDisabled(), true);
  const send = page.getByRole('button', { name: 'Enviar código no WhatsApp' });
  assert.equal(await send.isDisabled(), true);
  await page.locator('input[name="phone"]').fill('11987654321');
  assert.equal(await send.isEnabled(), true);
  await send.click();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: 'Confirmar código', exact: true }).click();
  await page.getByText('WhatsApp confirmado. Você já pode concluir o cadastro.').waitFor();
  assert.equal(await submit.isEnabled(), true);
  await page.locator('input[name="phone"]').fill('21987654321');
  assert.equal(await submit.isDisabled(), true, 'changing phone must invalidate confirmation');
  assert.equal(sends, 1);
  assert.equal(registrations, 0);
  assert.deepEqual(errors, []);
  console.log('Browser registration: required phone, code confirmation and changed-phone invalidation passed; no real sends/writes.');
} finally { await browser.close(); }
