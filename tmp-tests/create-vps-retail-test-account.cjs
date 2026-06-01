const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENV_FILE = path.join(__dirname, '..', '.env.vps.local');

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

function quoteEnv(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function appendLocalCredentials(account) {
  const lines = [
    '',
    `# Cliente retail de teste criado para validacao Auth VPS em ${new Date().toISOString()}`,
    `MDV_TEST_CUSTOMER_EMAIL=${quoteEnv(account.email)}`,
    `MDV_TEST_CUSTOMER_PASSWORD=${quoteEnv(account.password)}`,
    `MDV_TEST_CUSTOMER_CPF=${quoteEnv(account.cpf_cnpj)}`,
    `MDV_TEST_CUSTOMER_ID=${quoteEnv(account.customer_id)}`,
  ];
  fs.appendFileSync(ENV_FILE, `${lines.join('\n')}\n`, 'utf8');
}

function makeTestAccount() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(2).toString('hex');
  const cpfDigits = `${stamp}${crypto.randomInt(0, 999).toString().padStart(3, '0')}`.slice(-11);
  return {
    name: `Cliente Teste VPS ${stamp}`,
    email: `mdv.vps.retail+${stamp}.${suffix}@example.com`,
    cpf_cnpj: cpfDigits,
    phone: `8799${cpfDigits.slice(-7)}`,
    password: `MdvTest-${stamp}-${suffix}`,
    customer_type: 'retail',
  };
}

function resolveAdminCredentials(env) {
  return {
    email: env.MDV_ADMIN_EMAIL || env.ADMIN_EMAIL || env.VPS_ADMIN_EMAIL || env.DEFAULT_ADMIN_EMAIL,
    password: env.MDV_ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.VPS_ADMIN_PASSWORD || env.DEFAULT_ADMIN_PASSWORD,
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function postJsonWithAuth(url, body, options = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.syncKey ? { 'x-sync-key': options.syncKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

(async () => {
  const env = {
    ...parseEnv(ENV_FILE),
    ...parseEnv(path.join(__dirname, '..', '.env.local')),
  };
  const forceNew = process.env.MDV_FORCE_NEW_TEST_CUSTOMER === '1' || process.env.MDV_FORCE_NEW_TEST_CUSTOMER === 'true';
  if (!forceNew && env.MDV_TEST_CUSTOMER_EMAIL && env.MDV_TEST_CUSTOMER_PASSWORD) {
    console.log(JSON.stringify({
      ok: true,
      created: false,
      reason: 'existing_MDV_TEST_CUSTOMER_credentials',
      email: env.MDV_TEST_CUSTOMER_EMAIL,
      customer_id: env.MDV_TEST_CUSTOMER_ID || null,
    }, null, 2));
    return;
  }

  const baseUrl = String(env.VITE_VPS_BASE_URL || env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
  const syncKey = env.VPS_SYNC_KEY || env.VITE_VPS_SYNC_KEY || env.SYNC_SECRET;
  const account = makeTestAccount();
  const adminCredentials = resolveAdminCredentials(env);
  let adminSession = null;
  if (adminCredentials.email && adminCredentials.password) {
    const adminLogin = await postJson(`${baseUrl}/auth/login`, adminCredentials);
    if (adminLogin.response.ok && adminLogin.data?.customer?.company_id) {
      adminSession = adminLogin.data;
      account.company_id = adminLogin.data.customer.company_id;
    }
  }
  const { response, data } = await postJson(`${baseUrl}/auth/register`, account);
  let createdData = data;
  let creationMode = 'public_register';

  if (!response.ok && response.status >= 500 && adminSession?.token) {
    const customerId = crypto.randomUUID();
    const fallbackCustomer = await postJsonWithAuth(`${baseUrl}/table-data/customers`, {
      id: customerId,
      user_id: customerId,
      company_id: account.company_id,
      name: account.name,
      cpf: account.cpf_cnpj,
      cpf_cnpj: account.cpf_cnpj,
      email: account.email,
      phone: account.phone,
      customer_type: 'CUSTOMER',
      active: true,
      is_active: true,
      account_status: 'active',
      referral_code: `MV-${customerId.replace(/-/g, '').slice(0, 5).toUpperCase()}`,
    }, {
      token: adminSession.token,
      syncKey,
    });
    if (!fallbackCustomer.response.ok) {
      console.log(JSON.stringify({
        ok: false,
        created: false,
        status: fallbackCustomer.response.status,
        error: fallbackCustomer.data?.error || fallbackCustomer.response.statusText,
        register_status: response.status,
      }, null, 2));
      process.exit(1);
    }
    const authUser = await postJsonWithAuth(`${baseUrl}/auth/admin/users`, {
      customer_id: customerId,
      email: account.email,
      cpf_cnpj: account.cpf_cnpj,
      password: account.password,
    }, {
      token: adminSession.token,
      syncKey,
    });
    if (!authUser.response.ok) {
      console.log(JSON.stringify({
        ok: false,
        created: false,
        status: authUser.response.status,
        error: authUser.data?.error || authUser.response.statusText,
        register_status: response.status,
      }, null, 2));
      process.exit(1);
    }
    createdData = { customer: fallbackCustomer.data };
    creationMode = 'admin_table_data_fallback';
  } else if (!response.ok) {
    console.log(JSON.stringify({
      ok: false,
      created: false,
      status: response.status,
      error: data?.error || response.statusText,
    }, null, 2));
    process.exit(1);
  }

  appendLocalCredentials({
    ...account,
    customer_id: createdData?.customer?.id || '',
  });

  const login = await postJson(`${baseUrl}/auth/login`, {
    email: account.email,
    password: account.password,
  });

  const ok = login.response.ok && ['CUSTOMER', 'retail'].includes(login.data?.customer?.customer_type) && Boolean(login.data?.token);
  console.log(JSON.stringify({
    ok,
    created: true,
    mode: creationMode,
    status: response.ok ? response.status : 201,
    email: createdData?.customer?.email || account.email,
    customer_id: createdData?.customer?.id || null,
    customer_type: createdData?.customer?.customer_type || null,
    login_status: login.response.status,
    token_present: Boolean(login.data?.token),
    credentials_saved_to: '.env.vps.local',
  }, null, 2));
  if (!ok) process.exit(1);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
