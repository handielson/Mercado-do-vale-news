# WhatsApp Troca Numero Guiada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided admin flow to safely switch the WhatsApp number connected to the Mercado do Vale bot.

**Architecture:** Add a backend switch controller around the existing Evolution and bot pause helpers, then expose it through a focused frontend service and a new `WhatsAppNumberSwitchPanel` in the Centro WhatsApp page. The flow pauses the bot first, disconnects/connects the Evolution instance, validates the connected number/webhook, and only then lets the admin reactivate the bot.

**Tech Stack:** Fastify/Node in `vps_server.js` and `vps_server.cjs`, React/TypeScript, `vpsClient`, static regression tests under `tmp-tests`, Vite build.

---

### Task 1: Backend Guard Tests

**Files:**
- Create: `tmp-tests/whatsapp-number-switch-backend-static.test.mjs`
- Read: `vps_server.cjs`

- [ ] **Step 1: Write the failing static backend test**

Create `tmp-tests/whatsapp-number-switch-backend-static.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.cjs', 'utf8');

const endpoints = [
  ['GET', '/n8n-bot/whatsapp-switch/status'],
  ['POST', '/n8n-bot/whatsapp-switch/start'],
  ['POST', '/n8n-bot/whatsapp-switch/disconnect'],
  ['POST', '/n8n-bot/whatsapp-switch/connect'],
  ['POST', '/n8n-bot/whatsapp-switch/confirm'],
  ['POST', '/n8n-bot/whatsapp-switch/keep-paused'],
];

for (const [method, path] of endpoints) {
  const routeRegex = new RegExp(`fastify\\.${method.toLowerCase()}\\('${path.replace(/\//g, '\\/')}', \\{ preHandler: requireSyncKey \\}`);
  assert.match(source, routeRegex, `${method} ${path} must exist and require sync auth`);
}

assert.match(source, /async function getN8nBotWhatsAppSwitchStatus\(/, 'backend must expose consolidated switch status helper');
assert.match(source, /function sanitizeN8nBotEvolutionConnectResult\(/, 'backend must sanitize Evolution connect payloads before returning them');
assert.match(source, /EXPECTED_N8N_BOT_WEBHOOK_URL = 'https:\/\/n8n\.mercadodovale\.com\.br\/webhook\/whatsapp'/, 'backend must validate the production webhook URL');
assert.match(source, /setN8nBotGlobalControl\(\{\s*paused: true,\s*reason: 'Troca de numero WhatsApp iniciada'/s, 'start endpoint must pause the bot before switching');
assert.match(source, /setN8nBotGlobalControl\(\{\s*paused: false,\s*reason: ''/s, 'confirm endpoint must be able to reactivate the bot after validation');
assert.doesNotMatch(source, /return\s+\{\s*\.\.\.connectResult\.body,\s*webhook:/, 'switch connect endpoint must not return raw Evolution payloads blindly');

console.log('whatsapp number switch backend static checks passed');
```

- [ ] **Step 2: Run the backend test and verify it fails**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-backend-static.test.mjs
```

Expected: FAIL because the switch endpoints and helpers do not exist yet.

- [ ] **Step 3: Implement backend helpers and routes**

Modify both `vps_server.js` and `vps_server.cjs` near the existing `/n8n-bot/global-control` routes:

```js
const EXPECTED_N8N_BOT_WEBHOOK_URL = 'https://n8n.mercadodovale.com.br/webhook/whatsapp';
const EXPECTED_N8N_BOT_WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'];

function getN8nBotEvolutionInstanceName() {
  return String(process.env.N8N_BOT_EVOLUTION_INSTANCE_NAME || 'botmercadodovale').trim() || 'botmercadodovale';
}

function getN8nBotEvolutionBaseUrl() {
  return String(process.env.EVOLUTION_SERVER_URL || 'https://bot.mercadodovale.com.br').replace(/\/+$/, '');
}

function getN8nBotEvolutionApiKey() {
  return String(process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_GLOBAL_API_KEY || '');
}

async function callN8nBotEvolutionApi(path, method = 'GET', body = null) {
  const baseUrl = getN8nBotEvolutionBaseUrl();
  const apiKey = getN8nBotEvolutionApiKey();
  if (!apiKey) {
    const err = new Error('Evolution API key is not configured');
    err.statusCode = 500;
    throw err;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { ok: response.ok, status: response.status, body: parsed };
}

function extractN8nBotEvolutionInstance(raw) {
  const instanceName = getN8nBotEvolutionInstanceName();
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.instances) ? raw.instances : [];
  const found = list.find((item) => {
    const inst = item?.instance || item || {};
    return inst.instanceName === instanceName || inst.name === instanceName || item?.name === instanceName;
  }) || list[0] || null;
  const inst = found?.instance || found || {};
  const ownerJid = inst.ownerJid || found?.ownerJid || inst.owner || found?.owner || '';
  const phone = String(ownerJid || inst.number || found?.number || '').replace(/@.*/, '') || null;
  return {
    id: inst.id || found?.id || null,
    name: inst.instanceName || inst.name || found?.instanceName || found?.name || instanceName,
    state: inst.state || found?.state || found?.connectionStatus || null,
    phone,
    ownerJid: ownerJid || null,
    profileName: inst.profileName || found?.profileName || null,
  };
}

function sanitizeN8nBotWebhookConfig(raw) {
  const webhook = raw?.webhook || raw || {};
  return {
    enabled: webhook.enabled === true,
    url: webhook.url || '',
    webhookByEvents: webhook.webhookByEvents === true,
    webhookBase64: webhook.webhookBase64 === true,
    events: Array.isArray(webhook.events) ? webhook.events : [],
  };
}

function validateN8nBotWebhook(webhook) {
  const events = Array.isArray(webhook?.events) ? webhook.events : [];
  return Boolean(
    webhook?.enabled === true &&
    webhook?.url === EXPECTED_N8N_BOT_WEBHOOK_URL &&
    webhook?.webhookByEvents === false &&
    webhook?.webhookBase64 === true &&
    EXPECTED_N8N_BOT_WEBHOOK_EVENTS.every((event) => events.includes(event))
  );
}

function sanitizeN8nBotEvolutionConnectResult(raw) {
  return {
    base64: typeof raw?.base64 === 'string' ? raw.base64 : undefined,
    pairingCode: typeof raw?.pairingCode === 'string' ? raw.pairingCode : undefined,
    code: typeof raw?.code === 'string' ? raw.code : undefined,
    instance: raw?.instance && typeof raw.instance === 'object'
      ? {
          instanceName: raw.instance.instanceName || getN8nBotEvolutionInstanceName(),
          state: raw.instance.state || null,
        }
      : undefined,
  };
}
```

Add status and action routes:

```js
async function getN8nBotWhatsAppSwitchStatus(extra = {}) {
  const instanceName = getN8nBotEvolutionInstanceName();
  const [control, stateResult, instancesResult, webhookResult] = await Promise.all([
    getN8nBotGlobalControl(),
    callN8nBotEvolutionApi(`/instance/connectionState/${encodeURIComponent(instanceName)}`).catch((err) => ({ ok: false, status: err.statusCode || 0, body: { message: err.message } })),
    callN8nBotEvolutionApi('/instance/fetchInstances').catch((err) => ({ ok: false, status: err.statusCode || 0, body: [] })),
    callN8nBotEvolutionApi(`/webhook/find/${encodeURIComponent(instanceName)}`).catch((err) => ({ ok: false, status: err.statusCode || 0, body: { message: err.message } })),
  ]);
  const instance = extractN8nBotEvolutionInstance(instancesResult.body);
  const state = stateResult.body?.instance?.state || instance.state || null;
  const webhook = sanitizeN8nBotWebhookConfig(webhookResult.body);
  return {
    ok: true,
    instanceName,
    expectedWebhookUrl: EXPECTED_N8N_BOT_WEBHOOK_URL,
    control,
    evolution: {
      state,
      instance: { ...instance, state },
      connectionStatus: stateResult.status,
      instancesStatus: instancesResult.status,
    },
    webhook: {
      ...webhook,
      valid: validateN8nBotWebhook(webhook),
      status: webhookResult.status,
    },
    ...extra,
  };
}

fastify.get('/n8n-bot/whatsapp-switch/status', { preHandler: requireSyncKey }, async () => {
  return getN8nBotWhatsAppSwitchStatus();
});

fastify.post('/n8n-bot/whatsapp-switch/start', { preHandler: requireSyncKey }, async () => {
  await setN8nBotGlobalControl({
    paused: true,
    reason: 'Troca de numero WhatsApp iniciada',
    changedBy: 'admin-whatsapp-switch',
    changedByRemoteJid: '',
  });
  return getN8nBotWhatsAppSwitchStatus({ step: 'paused' });
});

fastify.post('/n8n-bot/whatsapp-switch/disconnect', { preHandler: requireSyncKey }, async () => {
  const control = await getN8nBotGlobalControl();
  if (!control.paused) {
    return { ok: false, error: 'BOT_NOT_PAUSED', message: 'Pause o bot antes de desconectar o WhatsApp.' };
  }
  const instanceName = getN8nBotEvolutionInstanceName();
  const result = await callN8nBotEvolutionApi(`/instance/logout/${encodeURIComponent(instanceName)}`, 'POST');
  return getN8nBotWhatsAppSwitchStatus({ step: 'disconnecting', disconnect: { ok: result.ok, status: result.status } });
});

fastify.post('/n8n-bot/whatsapp-switch/connect', { preHandler: requireSyncKey }, async () => {
  const control = await getN8nBotGlobalControl();
  if (!control.paused) {
    return { ok: false, error: 'BOT_NOT_PAUSED', message: 'Pause o bot antes de gerar QR Code.' };
  }
  const instanceName = getN8nBotEvolutionInstanceName();
  const result = await callN8nBotEvolutionApi(`/instance/connect/${encodeURIComponent(instanceName)}`);
  return getN8nBotWhatsAppSwitchStatus({
    step: 'awaiting_qr_scan',
    connect: { ok: result.ok, status: result.status, ...sanitizeN8nBotEvolutionConnectResult(result.body) },
  });
});

fastify.post('/n8n-bot/whatsapp-switch/confirm', { preHandler: requireSyncKey }, async (req) => {
  const status = await getN8nBotWhatsAppSwitchStatus();
  if (status.evolution.state !== 'open' || !status.evolution.instance.phone) {
    return { ok: false, error: 'INSTANCE_NOT_OPEN', message: 'Conecte um numero antes de confirmar.', status };
  }
  if (!status.webhook.valid) {
    return { ok: false, error: 'WEBHOOK_INVALID', message: 'Webhook da Evolution esta divergente.', status };
  }
  if (req.body?.reactivate !== false) {
    await setN8nBotGlobalControl({
      paused: false,
      reason: '',
      changedBy: 'admin-whatsapp-switch',
      changedByRemoteJid: '',
    });
  }
  return getN8nBotWhatsAppSwitchStatus({ step: req.body?.reactivate === false ? 'paused_for_manual_test' : 'completed' });
});

fastify.post('/n8n-bot/whatsapp-switch/keep-paused', { preHandler: requireSyncKey }, async () => {
  await setN8nBotGlobalControl({
    paused: true,
    reason: 'Troca de numero WhatsApp mantida em teste manual',
    changedBy: 'admin-whatsapp-switch',
    changedByRemoteJid: '',
  });
  return getN8nBotWhatsAppSwitchStatus({ step: 'paused_for_manual_test' });
});
```

- [ ] **Step 4: Run the backend test and syntax checks**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-backend-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
```

Expected: all PASS / no syntax output.

### Task 2: Frontend Service Guard Tests

**Files:**
- Create: `tmp-tests/whatsapp-number-switch-service-static.test.mjs`
- Modify: `services/autoResponderService.ts`

- [ ] **Step 1: Write the failing service test**

Create `tmp-tests/whatsapp-number-switch-service-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoResponderService.ts', 'utf8');

const requiredMethods = [
  ['getWhatsAppSwitchStatus', "vpsClient.get<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/status')"],
  ['startWhatsAppNumberSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/start', {})"],
  ['disconnectWhatsAppForSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/disconnect', {})"],
  ['connectWhatsAppForSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/connect', {})"],
  ['confirmWhatsAppNumberSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/confirm', { reactivate })"],
  ['keepWhatsAppSwitchPaused', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/keep-paused', {})"],
];

assert.match(source, /export interface WhatsAppSwitchStatus/, 'service must export WhatsAppSwitchStatus');
for (const [method, call] of requiredMethods) {
  assert.match(source, new RegExp(`${method}:`), `service must expose ${method}`);
  assert.ok(source.includes(call), `${method} must call ${call}`);
}

console.log('whatsapp number switch service static checks passed');
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-service-static.test.mjs
```

Expected: FAIL because service types and methods do not exist.

- [ ] **Step 3: Add service types and methods**

Modify `services/autoResponderService.ts` near the WhatsApp connection methods:

```ts
export interface WhatsAppSwitchStatus {
    ok: boolean;
    step?: 'idle' | 'paused' | 'disconnecting' | 'awaiting_qr_scan' | 'connected_pending_confirmation' | 'completed' | 'paused_for_manual_test' | 'error';
    instanceName: string;
    expectedWebhookUrl: string;
    control: {
        paused: boolean;
        reason?: string | null;
        changed_by?: string | null;
        changed_at?: string | null;
    };
    evolution: {
        state?: string | null;
        instance?: {
            id?: string | null;
            name?: string | null;
            state?: string | null;
            phone?: string | null;
            ownerJid?: string | null;
            profileName?: string | null;
        };
    };
    webhook: {
        enabled: boolean;
        url: string;
        webhookByEvents: boolean;
        webhookBase64: boolean;
        events: string[];
        valid: boolean;
    };
    connect?: {
        ok: boolean;
        status: number;
        base64?: string;
        pairingCode?: string;
        code?: string;
        instance?: { instanceName?: string; state?: string | null };
    };
    error?: string;
    message?: string;
}
```

Add methods inside `autoResponderService`:

```ts
    getWhatsAppSwitchStatus: (): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.get<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/status');
    },

    startWhatsAppNumberSwitch: (): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/start', {});
    },

    disconnectWhatsAppForSwitch: (): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/disconnect', {});
    },

    connectWhatsAppForSwitch: (): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/connect', {});
    },

    confirmWhatsAppNumberSwitch: (reactivate = true): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/confirm', { reactivate });
    },

    keepWhatsAppSwitchPaused: (): Promise<WhatsAppSwitchStatus> => {
        return vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/keep-paused', {});
    },
```

- [ ] **Step 4: Run the service test**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-service-static.test.mjs
```

Expected: PASS.

### Task 3: Frontend Panel Tests

**Files:**
- Create: `tmp-tests/whatsapp-number-switch-panel-static.test.mjs`
- Create: `components/whatsapp/WhatsAppNumberSwitchPanel.tsx`
- Modify: `pages/admin/settings/WhatsAppPage.tsx`

- [ ] **Step 1: Write the failing panel test**

Create `tmp-tests/whatsapp-number-switch-panel-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('components/whatsapp/WhatsAppNumberSwitchPanel.tsx', 'utf8');
const page = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');

const requiredText = [
  'Troca segura de numero',
  'Iniciar troca de numero',
  'Desconectar WhatsApp atual',
  'Gerar QR Code do novo numero',
  'Confirmar este numero como oficial',
  'Manter bot pausado e sair',
  'Checklist final',
];

for (const text of requiredText) {
  assert.ok(panel.includes(text), `panel must render "${text}"`);
}

const requiredCalls = [
  'autoResponderService.getWhatsAppSwitchStatus',
  'autoResponderService.startWhatsAppNumberSwitch',
  'autoResponderService.disconnectWhatsAppForSwitch',
  'autoResponderService.connectWhatsAppForSwitch',
  'autoResponderService.confirmWhatsAppNumberSwitch',
  'autoResponderService.keepWhatsAppSwitchPaused',
];

for (const call of requiredCalls) {
  assert.ok(panel.includes(call), `panel must call ${call}`);
}

assert.match(panel, /window\.confirm\('Desconectar o WhatsApp atual/, 'disconnect action must require explicit confirmation');
assert.match(panel, /status\?\.control\?\.paused !== true/, 'dangerous actions must be blocked unless bot is paused');
assert.match(panel, /status\?\.evolution\?\.state === 'open'/, 'confirmation must depend on Evolution open state');
assert.match(page, /import \{ WhatsAppNumberSwitchPanel \}/, 'WhatsApp page must import the switch panel');
assert.match(page, /<WhatsAppNumberSwitchPanel \/>/, 'WhatsApp page must render the switch panel');

console.log('whatsapp number switch panel static checks passed');
```

- [ ] **Step 2: Run the panel test and verify it fails**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-panel-static.test.mjs
```

Expected: FAIL because the panel file does not exist.

- [ ] **Step 3: Implement the panel**

Create `components/whatsapp/WhatsAppNumberSwitchPanel.tsx` with a focused state-machine UI that:

- loads switch status on mount;
- polls every 4 seconds while awaiting QR scan or while connected but not confirmed;
- calls start/disconnect/connect/confirm/keep-paused service methods;
- renders QR Code from `status.connect.base64`;
- disables disconnect/connect when `status?.control?.paused !== true`;
- disables confirm unless `status?.evolution?.state === 'open'`, a connected phone exists, and webhook is valid.

- [ ] **Step 4: Render panel in Centro WhatsApp**

Modify `pages/admin/settings/WhatsAppPage.tsx`:

```tsx
import { WhatsAppNumberSwitchPanel } from '../../../components/whatsapp/WhatsAppNumberSwitchPanel';
```

Render after `<WhatsAppConnectionPanel />`:

```tsx
<WhatsAppNumberSwitchPanel />
```

- [ ] **Step 5: Run panel test**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-panel-static.test.mjs
```

Expected: PASS.

### Task 4: Full Verification

**Files:**
- Validate all touched files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-backend-static.test.mjs
node tmp-tests\whatsapp-number-switch-service-static.test.mjs
node tmp-tests\whatsapp-number-switch-panel-static.test.mjs
node tmp-tests\autoresponder-evolution-typing-presence-static.test.mjs
node tmp-tests\n8n-admin-client-control-static.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run syntax and build checks**

Run:

```powershell
node --check server.js
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run build
```

Expected: checks pass and Vite build succeeds.

- [ ] **Step 3: Inspect diff**

Run:

```powershell
git status -sb
git diff --stat
git diff -- vps_server.js vps_server.cjs services/autoResponderService.ts components/whatsapp/WhatsAppNumberSwitchPanel.tsx pages/admin/settings/WhatsAppPage.tsx
```

Expected: only planned files changed.

### Task 5: Version, Commit, Publish

**Files:**
- Modify: `public/VERSION.json`
- Modify: `VERSAO_ATUAL.md`
- Create: `docs/versoes/2026-07-07-v1.2.89-whatsapp-troca-numero-guiada.md`

- [ ] **Step 1: Run publish plan**

Run:

```powershell
npm.cmd run publish:vps-plan -- --slug whatsapp-troca-numero-guiada --summary "Adiciona fluxo guiado para troca segura do numero WhatsApp"
```

Expected: scope includes API and frontend.

- [ ] **Step 2: Update version artifacts**

Set version to:

```text
v1.2.89-whatsapp-troca-numero-guiada
```

Use release path:

```text
/var/www/mdv-site/releases/20260707-224500-whatsapp-troca-numero-guiada
```

- [ ] **Step 3: Re-run validation**

Run:

```powershell
node tmp-tests\whatsapp-number-switch-backend-static.test.mjs
node tmp-tests\whatsapp-number-switch-service-static.test.mjs
node tmp-tests\whatsapp-number-switch-panel-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run build
```

Expected: all pass.

- [ ] **Step 4: Stage scoped files**

Run:

```powershell
git add -- docs/superpowers/plans/2026-07-07-whatsapp-troca-numero-guiada.md tmp-tests/whatsapp-number-switch-backend-static.test.mjs tmp-tests/whatsapp-number-switch-service-static.test.mjs tmp-tests/whatsapp-number-switch-panel-static.test.mjs vps_server.js vps_server.cjs services/autoResponderService.ts components/whatsapp/WhatsAppNumberSwitchPanel.tsx pages/admin/settings/WhatsAppPage.tsx public/VERSION.json VERSAO_ATUAL.md docs/versoes/2026-07-07-v1.2.89-whatsapp-troca-numero-guiada.md
```

- [ ] **Step 5: Commit, tag, push**

Run:

```powershell
git commit -m "Adiciona troca guiada do WhatsApp"
git tag v1.2.89-whatsapp-troca-numero-guiada
git push origin HEAD:main
git push origin v1.2.89-whatsapp-troca-numero-guiada
```

- [ ] **Step 6: Deploy site and API**

Run:

```powershell
$env:VPS_SITE_RELEASE_NAME='20260707-224500-whatsapp-troca-numero-guiada'
npm.cmd run deploy:vps-site
node deploy-vps-server-only.cjs
```

- [ ] **Step 7: Production validation**

Run:

```powershell
curl.exe -s -i https://api.xiaomipetrolina.com.br/status
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" https://www.mercadodovale.com.br/
curl.exe -s https://www.mercadodovale.com.br/VERSION.json
```

Expected: API 200 with `mysql.ok=true`, site 200, version JSON reports `v1.2.89-whatsapp-troca-numero-guiada`.

---

## Self-Review

- Spec coverage: backend endpoints, frontend panel, QR/pairing code, pause-before-disconnect, confirmation-before-reactivation, keep-paused action, webhook validation, and tests are all covered.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation steps remain.
- Type consistency: service method names match panel calls; backend route names match service paths; switch status fields are consistent across backend, service, and panel.
