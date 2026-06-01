const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getLocalEnv() {
  return {
    ...parseEnv(path.join(__dirname, '..', '.env.vps.local')),
    ...parseEnv(path.join(__dirname, '..', '.env.local')),
  };
}

function resolveAdminCredentials(env) {
  return {
    email: env.MDV_ADMIN_EMAIL || env.ADMIN_EMAIL || env.VPS_ADMIN_EMAIL || env.DEFAULT_ADMIN_EMAIL,
    password: env.MDV_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.VPS_ADMIN_PASSWORD || env.DEFAULT_ADMIN_PASSWORD,
  };
}

function resolveRetailCredentials(env) {
  return {
    email: env.MDV_TEST_CUSTOMER_EMAIL || env.MDV_RETAIL_TEST_EMAIL || env.CUSTOMER_TEST_EMAIL,
    password: env.MDV_TEST_CUSTOMER_PASSWORD || env.MDV_RETAIL_TEST_PASSWORD || env.CUSTOMER_TEST_PASSWORD,
  };
}

async function readSession(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('@mdv_vps_auth_session');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return {
        token_present: Boolean(parsed?.token),
        email: parsed?.user?.email || parsed?.customer?.email || null,
        customer_type: parsed?.customer?.customer_type || null,
      };
    } catch {
      return { token_present: false, email: null, customer_type: null };
    }
  });
}

async function runAdminLogin(browser, baseUrl, credentials) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Acessar Painel Admin' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/admin') && url.pathname !== '/admin/login', { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const session = await readSession(page);
  const result = {
    ok: Boolean(session?.token_present && session?.customer_type === 'ADMIN'),
    url: page.url(),
    customer_type: session?.customer_type || null,
    token_present: Boolean(session?.token_present),
  };
  await context.close();
  return result;
}

async function runCustomerLoginRoute(browser, baseUrl, credentials, expectedType = null) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/cliente/login?next=/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'E-mail' }).click();
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => url.pathname !== '/cliente/login', { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const session = await readSession(page);
  const result = {
    ok: Boolean(session?.token_present && (!expectedType || session?.customer_type === expectedType || (expectedType === 'retail' && session?.customer_type === 'CUSTOMER'))),
    url: page.url(),
    customer_type: session?.customer_type || null,
    token_present: Boolean(session?.token_present),
  };
  await context.close();
  return result;
}

(async () => {
  const env = getLocalEnv();
  const credentials = resolveAdminCredentials(env);
  const retailCredentials = resolveRetailCredentials(env);
  if (!credentials.email || !credentials.password) {
    throw new Error('Missing local MDV_ADMIN_EMAIL/MDV_ADMIN_PASSWORD for browser verification');
  }
  if (!retailCredentials.email || !retailCredentials.password) {
    throw new Error('Missing local MDV_TEST_CUSTOMER_EMAIL/MDV_TEST_CUSTOMER_PASSWORD for browser verification');
  }

  const baseUrl = String(env.MDV_SITE_URL || env.VITE_PUBLIC_SITE_URL || 'https://www.mercadodovale.com.br').replace(/\/+$/, '');
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromeExecutable(),
  });
  try {
    const admin = await runAdminLogin(browser, baseUrl, credentials);
    const customerRoute = await runCustomerLoginRoute(browser, baseUrl, retailCredentials, 'retail');
    const ok = admin.ok && customerRoute.ok;
    console.log(JSON.stringify({
      ok,
      base_url: baseUrl,
      admin,
      customer_route: customerRoute,
    }, null, 2));
    if (!ok) process.exit(1);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
