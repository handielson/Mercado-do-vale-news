# Pix Avulso Mercado Pago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Mercado Pago Pix page with 10-minute expiration, audit trail, public share link, WhatsApp sharing, display support, and future cash-closing fields.

**Architecture:** Reuse the existing `pdv_pix_payments` table and display infrastructure, adding standalone metadata columns and new `/pix/standalone` and `/pix/public/:token` VPS routes. The frontend gets a focused admin page, a public payment page, and a `standalonePixService` that wraps `vpsClient`.

**Tech Stack:** React 18, Vite, TypeScript, Fastify VPS server, MySQL, Mercado Pago REST API, static Node test files in `tmp-tests`.

---

## File Map

- Modify `vps_server.js`: add helpers, schema columns, standalone Pix routes, public Pix route, webhook handling for standalone metadata, display cleanup on unpaid expiration.
- Modify `vps_server.cjs`: mirror the same backend changes as `vps_server.js`.
- Create `services/standalonePixService.ts`: typed frontend API for create/list/status/share/public helpers.
- Create `types/standalonePix.ts`: shared frontend types and status labels.
- Create `pages/admin/financial/StandalonePixPage.tsx`: admin page for form, current QR, WhatsApp sharing, display action, and extract.
- Create `pages/store/PublicPixPage.tsx`: public token page for QR, copy code, expiration and cancelled state.
- Modify `routes/index.tsx`: lazy-load pages and add `/admin/pix-avulso` plus `/pix/:token`.
- Modify `layouts/AdminLayout.tsx`: add Financeiro menu item `Pix Avulso`.
- Test `tmp-tests/standalone-pix-backend-static.test.mjs`: backend/schema/webhook/static route checks.
- Test `tmp-tests/standalone-pix-frontend-static.test.mjs`: service, routes, menu, admin page, public page checks.

---

### Task 1: Static Backend Contract Test

**Files:**
- Create: `tmp-tests/standalone-pix-backend-static.test.mjs`
- Test: `tmp-tests/standalone-pix-backend-static.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertBackend(source, label) {
  for (const snippet of [
    "fastify.post('/pix/standalone'",
    "fastify.get('/pix/standalone'",
    "fastify.get('/pix/standalone/:id/status'",
    "fastify.post('/pix/standalone/:id/share-whatsapp'",
    "fastify.get('/pix/public/:token'",
    "metadata: {",
    "flow: 'standalone_pix'",
    "external_reference: `standalone_pix:${id}`",
    'date_of_expiration',
    'STANDALONE_PIX_EXPIRATION_MINUTES = 10',
    'public_token',
    'cancel_reason',
    'unpaid_expired',
    'shared_phone',
    'share_channel',
    'cash_closing_id',
    'Cancelado por falta de pagamento',
    'clearDisplayActivePixIfMatches',
  ]) {
    assert.ok(source.includes(snippet), `${label} must include ${snippet}`);
  }

  assert.match(
    source,
    /addColumnIfMissing\('pdv_pix_payments', 'source', "VARCHAR\(40\) NOT NULL DEFAULT 'pdv_sale'"\)/,
    `${label} must add source column with pdv_sale default`
  );
  assert.match(
    source,
    /addColumnIfMissing\('pdv_pix_payments', 'expires_at', 'DATETIME NULL'\)/,
    `${label} must add expires_at column`
  );
  assert.match(
    source,
    /normalizeStandalonePixStatusLabel[\s\S]*Cancelado por falta de pagamento/,
    `${label} must expose unpaid expiration label`
  );
}

assertBackend(server, 'vps_server.js');
assertBackend(serverCjs, 'vps_server.cjs');

console.log('standalone pix backend static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests/standalone-pix-backend-static.test.mjs`

Expected: FAIL because `/pix/standalone` routes and new columns do not exist yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add tmp-tests/standalone-pix-backend-static.test.mjs
git commit -m "test: add standalone pix backend contract"
```

---

### Task 2: Backend Schema and Helpers

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/standalone-pix-backend-static.test.mjs`

- [ ] **Step 1: Add backend constants and helpers near the existing PDV display helpers**

Add this code near `getPdvMercadoPagoAccessToken`, `buildPdvPixResponse`, or the surrounding Pix/display helper area in both server files:

```js
const STANDALONE_PIX_EXPIRATION_MINUTES = 10;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function buildPublicToken() {
  return crypto.randomBytes(24).toString('hex');
}

function normalizeStandalonePixStatusLabel(row) {
  if (row?.cancel_reason === 'unpaid_expired') return 'Cancelado por falta de pagamento';
  const status = normalizePdvPixStatus(row?.status);
  if (status === 'approved') return 'Aprovado';
  if (status === 'pending' || status === 'creating') return 'Pendente';
  if (status === 'expired') return 'Cancelado por falta de pagamento';
  if (status === 'rejected') return 'Rejeitado';
  return 'Erro';
}

function isStandalonePixExpired(row, now = new Date()) {
  if (!row?.expires_at) return false;
  if (normalizePdvPixStatus(row.status) === 'approved') return false;
  return new Date(row.expires_at).getTime() <= now.getTime();
}

async function clearDisplayActivePixIfMatches(pixPaymentId) {
  await pool.query(
    'UPDATE pdv_displays SET active_pix_payment_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE active_pix_payment_id = ?',
    [pixPaymentId]
  );
}

function buildStandalonePixResponse(row, options = {}) {
  if (!row) return null;
  const status = row.cancel_reason === 'unpaid_expired' ? 'expired' : normalizePdvPixStatus(row.status);
  const publicPath = row.public_token ? `/pix/${row.public_token}` : null;
  const publicUrl = publicPath && options.publicBaseUrl ? `${options.publicBaseUrl}${publicPath}` : publicPath;
  return {
    ...buildPdvPixResponse(row),
    source: row.source || 'pdv_sale',
    public_token: row.public_token || null,
    public_path: publicPath,
    public_url: publicUrl,
    description: row.description || null,
    expires_at: row.expires_at || null,
    cancel_reason: row.cancel_reason || null,
    status,
    status_label: normalizeStandalonePixStatusLabel(row),
    shared_phone: row.shared_phone || null,
    shared_at: row.shared_at || null,
    share_channel: row.share_channel || null,
    approved_at: row.approved_at || null,
    cash_closing_id: row.cash_closing_id || null,
  };
}
```

- [ ] **Step 2: Add schema columns in `ensureVpsSchema`**

In both server files, after the existing `CREATE TABLE IF NOT EXISTS pdv_pix_payments` block and current `addColumnIfMissing` calls for that table, add:

```js
  await addColumnIfMissing('pdv_pix_payments', 'source', "VARCHAR(40) NOT NULL DEFAULT 'pdv_sale'");
  await addColumnIfMissing('pdv_pix_payments', 'public_token', 'VARCHAR(80) NULL');
  await addColumnIfMissing('pdv_pix_payments', 'description', 'VARCHAR(255) NULL');
  await addColumnIfMissing('pdv_pix_payments', 'expires_at', 'DATETIME NULL');
  await addColumnIfMissing('pdv_pix_payments', 'cancel_reason', 'VARCHAR(80) NULL');
  await addColumnIfMissing('pdv_pix_payments', 'shared_phone', 'VARCHAR(40) NULL');
  await addColumnIfMissing('pdv_pix_payments', 'shared_at', 'DATETIME NULL');
  await addColumnIfMissing('pdv_pix_payments', 'share_channel', 'VARCHAR(40) NULL');
  await addColumnIfMissing('pdv_pix_payments', 'approved_at', 'DATETIME NULL');
  await addColumnIfMissing('pdv_pix_payments', 'cash_closing_id', 'VARCHAR(80) NULL');
  await addIndexIfMissing('pdv_pix_payments', 'idx_pdv_pix_source_created', 'source, created_at');
  await addIndexIfMissing('pdv_pix_payments', 'idx_pdv_pix_public_token', 'public_token');
  await addIndexIfMissing('pdv_pix_payments', 'idx_pdv_pix_expires', 'expires_at');
```

- [ ] **Step 3: Run backend static test**

Run: `node tmp-tests/standalone-pix-backend-static.test.mjs`

Expected: still FAIL because routes are not implemented yet, but schema/helper assertions should be closer.

---

### Task 3: Standalone Pix VPS Routes

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/standalone-pix-backend-static.test.mjs`

- [ ] **Step 1: Add route implementation after existing `/pdv/pix-payments/:id/status` route**

Add this block in both server files:

```js
fastify.post('/pix/standalone', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const amount = Math.round(Number(body.amount || body.amount_cents || 0));
  if (!amount || amount <= 0) return reply.code(400).send({ error: 'amount obrigatorio em centavos' });

  const mp = await getPdvMercadoPagoAccessToken();
  if (!mp?.accessToken) return reply.code(400).send({ error: 'Mercado Pago nao configurado' });

  const id = crypto.randomUUID();
  const publicToken = buildPublicToken();
  const description = String(body.description || 'Pix avulso Mercado do Vale').trim().slice(0, 120);
  const cashierKey = String(body.cashier_key || 'caixa-01').trim() || 'caixa-01';
  const displayId = body.display_id ? String(body.display_id) : null;
  const expiresAt = addMinutes(new Date(), STANDALONE_PIX_EXPIRATION_MINUTES);

  const payload = {
    transaction_amount: Number((amount / 100).toFixed(2)),
    description,
    payment_method_id: 'pix',
    external_reference: `standalone_pix:${id}`,
    date_of_expiration: expiresAt.toISOString(),
    metadata: {
      flow: 'standalone_pix',
      standalone_pix_payment_id: id,
      cashier_key: cashierKey,
      display_id: displayId,
    },
    notification_url: 'https://www.mercadodovale.com.br/api/mercadopago-webhook',
    payer: {
      email: String(body.payer_email || 'cliente@mercadodovale.com.br'),
    },
  };

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mp.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': id,
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    await pool.query(
      `INSERT INTO pdv_pix_payments
        (id, source, public_token, description, local_reference, cashier_key, display_id, amount, status, expires_at, raw_response_json)
       VALUES (?, 'standalone_pix', ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
      [id, publicToken, description, `standalone_pix:${id}`, cashierKey, displayId, amount, formatDateTimeSql(expiresAt), JSON.stringify(raw)]
    );
    return reply.code(502).send({ error: 'Falha ao criar Pix Mercado Pago', detail: raw?.message || raw?.error || response.statusText });
  }

  const qr = raw?.point_of_interaction?.transaction_data || {};
  await pool.query(
    `INSERT INTO pdv_pix_payments
      (id, source, public_token, description, local_reference, cashier_key, display_id, mercado_pago_payment_id, amount, status, qr_code, qr_code_base64, ticket_url, expires_at, raw_response_json)
     VALUES (?, 'standalone_pix', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      publicToken,
      description,
      `standalone_pix:${id}`,
      cashierKey,
      displayId,
      raw.id ? String(raw.id) : null,
      amount,
      normalizePdvPixStatus(raw.status),
      qr.qr_code || null,
      qr.qr_code_base64 || null,
      qr.ticket_url || null,
      formatDateTimeSql(expiresAt),
      JSON.stringify(raw),
    ]
  );

  if (displayId) {
    await pool.query('UPDATE pdv_displays SET active_pix_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id, displayId]);
  }

  const [rows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [id]);
  return reply.code(201).send(buildStandalonePixResponse(rows[0]));
});
```

- [ ] **Step 2: Add list/status/share/public routes**

Add this block immediately after the create route in both server files:

```js
fastify.get('/pix/standalone', { preHandler: requireSyncKey }, async (req) => {
  const query = req.query || {};
  const conditions = ["source = 'standalone_pix'"];
  const params = [];

  if (query.status) {
    conditions.push('status = ?');
    params.push(String(query.status));
  }
  if (query.cashier_key) {
    conditions.push('cashier_key = ?');
    params.push(String(query.cashier_key));
  }
  if (query.display_id) {
    conditions.push('display_id = ?');
    params.push(String(query.display_id));
  }
  if (query.date_from) {
    conditions.push('created_at >= ?');
    params.push(`${String(query.date_from).slice(0, 10)} 00:00:00`);
  }
  if (query.date_to) {
    conditions.push('created_at <= ?');
    params.push(`${String(query.date_to).slice(0, 10)} 23:59:59`);
  }
  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    conditions.push('(description LIKE ? OR mercado_pago_payment_id LIKE ? OR shared_phone LIKE ? OR local_reference LIKE ?)');
    params.push(term, term, term, term);
  }

  const limit = Math.max(1, Math.min(200, Number(query.limit || 50)));
  const [rows] = await pool.query(
    `SELECT * FROM pdv_pix_payments WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
    params
  );
  return { data: rows.map((row) => buildStandalonePixResponse(row)) };
});

fastify.get('/pix/standalone/:id/status', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query("SELECT * FROM pdv_pix_payments WHERE id = ? AND source = 'standalone_pix' LIMIT 1", [req.params.id]);
  const current = rows[0];
  if (!current) return reply.code(404).send({ error: 'Pix avulso nao encontrado' });

  if (isStandalonePixExpired(current)) {
    await pool.query(
      "UPDATE pdv_pix_payments SET status = 'expired', cancel_reason = 'unpaid_expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );
    await clearDisplayActivePixIfMatches(current.id);
    const [updatedRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [current.id]);
    return buildStandalonePixResponse(updatedRows[0]);
  }

  if (!current.mercado_pago_payment_id) return buildStandalonePixResponse(current);

  const mp = await getPdvMercadoPagoAccessToken();
  if (!mp?.accessToken) return reply.code(400).send({ error: 'Mercado Pago nao configurado' });

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(current.mercado_pago_payment_id)}`, {
    headers: { Authorization: `Bearer ${mp.accessToken}` },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) return reply.code(502).send({ error: 'Falha ao consultar Mercado Pago', detail: raw?.message || raw?.error || response.statusText });

  const status = normalizePdvPixStatus(raw.status);
  await pool.query(
    'UPDATE pdv_pix_payments SET status = ?, raw_response_json = ?, approved_at = IF(? = "approved", COALESCE(approved_at, CURRENT_TIMESTAMP), approved_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, JSON.stringify(raw), status, current.id]
  );
  const [updatedRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [current.id]);
  return buildStandalonePixResponse(updatedRows[0]);
});

fastify.post('/pix/standalone/:id/share-whatsapp', { preHandler: requireSyncKey }, async (req, reply) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (phone.length < 10) return reply.code(400).send({ error: 'Telefone WhatsApp invalido' });

  const [rows] = await pool.query("SELECT * FROM pdv_pix_payments WHERE id = ? AND source = 'standalone_pix' LIMIT 1", [req.params.id]);
  const current = rows[0];
  if (!current) return reply.code(404).send({ error: 'Pix avulso nao encontrado' });

  await pool.query(
    "UPDATE pdv_pix_payments SET shared_phone = ?, shared_at = CURRENT_TIMESTAMP, share_channel = 'whatsapp_link', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [phone, current.id]
  );
  const [updatedRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [current.id]);
  const pix = buildStandalonePixResponse(updatedRows[0], { publicBaseUrl: 'https://www.mercadodovale.com.br' });
  const text = [
    'Mercado do Vale - Pix avulso',
    `Valor: R$ ${(Number(pix.amount || 0) / 100).toFixed(2).replace('.', ',')}`,
    pix.description ? `Descricao: ${pix.description}` : '',
    `Link para pagar: ${pix.public_url}`,
    'Este Pix vence em 10 minutos.',
    'Abra o link para escanear o QR Code ou copiar o codigo Pix.',
  ].filter(Boolean).join('\n');
  return { ...pix, whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
});

fastify.get('/pix/public/:token', async (req, reply) => {
  const token = String(req.params.token || '').trim();
  if (!token) return reply.code(404).send({ error: 'Pix nao encontrado' });
  const [rows] = await pool.query("SELECT * FROM pdv_pix_payments WHERE public_token = ? AND source = 'standalone_pix' LIMIT 1", [token]);
  const current = rows[0];
  if (!current) return reply.code(404).send({ error: 'Pix nao encontrado' });

  if (isStandalonePixExpired(current)) {
    await pool.query(
      "UPDATE pdv_pix_payments SET status = 'expired', cancel_reason = 'unpaid_expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );
    await clearDisplayActivePixIfMatches(current.id);
    const [updatedRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [current.id]);
    return buildStandalonePixResponse(updatedRows[0]);
  }

  return buildStandalonePixResponse(current);
});
```

- [ ] **Step 3: Run backend static test**

Run: `node tmp-tests/standalone-pix-backend-static.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit backend routes**

```bash
git add vps_server.js vps_server.cjs tmp-tests/standalone-pix-backend-static.test.mjs
git commit -m "feat: add standalone pix backend routes"
```

---

### Task 4: Frontend Static Contract Test

**Files:**
- Create: `tmp-tests/standalone-pix-frontend-static.test.mjs`
- Test: `tmp-tests/standalone-pix-frontend-static.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf8');

const service = read('services/standalonePixService.ts');
const types = read('types/standalonePix.ts');
const adminPage = read('pages/admin/financial/StandalonePixPage.tsx');
const publicPage = read('pages/store/PublicPixPage.tsx');
const routes = read('routes/index.tsx');
const layout = read('layouts/AdminLayout.tsx');

for (const snippet of [
  "vpsClient.post<StandalonePixPayment>('/pix/standalone'",
  "vpsClient.get<{ data: StandalonePixPayment[] }>('/pix/standalone",
  "vpsClient.get<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/status`",
  "vpsClient.post<StandalonePixShareResponse>(`/pix/standalone/${encodeURIComponent(id)}/share-whatsapp`",
  "vpsClient.get<StandalonePixPayment>(`/pix/public/${encodeURIComponent(token)}`",
]) {
  assert.ok(service.includes(snippet), `standalonePixService.ts must include ${snippet}`);
}

for (const snippet of [
  'StandalonePixPayment',
  'Cancelado por falta de pagamento',
  'isStandalonePixPayable',
  'formatStandalonePixStatus',
]) {
  assert.ok(types.includes(snippet), `types/standalonePix.ts must include ${snippet}`);
}

for (const snippet of [
  'Pix Avulso',
  'Gerar Pix',
  'Copiar codigo Pix',
  'Copiar link publico',
  'Compartilhar no WhatsApp',
  'Exibir no display',
  'Cancelado por falta de pagamento',
  'pdvDisplayService.setActivePix',
  'standalonePixService.create',
  'standalonePixService.list',
  'standalonePixService.shareWhatsApp',
]) {
  assert.ok(adminPage.includes(snippet), `StandalonePixPage.tsx must include ${snippet}`);
}

for (const snippet of [
  'useParams',
  'standalonePixService.getPublic',
  'Copiar codigo Pix',
  'Cancelado por falta de pagamento',
  'qr_code_base64',
  'Pix copia e cola',
]) {
  assert.ok(publicPage.includes(snippet), `PublicPixPage.tsx must include ${snippet}`);
}

assert.ok(routes.includes("const StandalonePixPage = lazy(() => import('../pages/admin/financial/StandalonePixPage'))"), 'routes must lazy load admin standalone pix page');
assert.ok(routes.includes("const PublicPixPage = lazy(() => import('../pages/store/PublicPixPage'))"), 'routes must lazy load public pix page');
assert.ok(routes.includes('path: "/admin/pix-avulso"'), 'routes must expose /admin/pix-avulso');
assert.ok(routes.includes('path: "/pix/:token"'), 'routes must expose /pix/:token');
assert.ok(layout.includes("to: '/admin/pix-avulso'"), 'AdminLayout must add Pix Avulso menu item');

console.log('standalone pix frontend static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests/standalone-pix-frontend-static.test.mjs`

Expected: FAIL because files do not exist yet.

- [ ] **Step 3: Commit failing test**

```bash
git add tmp-tests/standalone-pix-frontend-static.test.mjs
git commit -m "test: add standalone pix frontend contract"
```

---

### Task 5: Frontend Types and Service

**Files:**
- Create: `types/standalonePix.ts`
- Create: `services/standalonePixService.ts`
- Test: `tmp-tests/standalone-pix-frontend-static.test.mjs`

- [ ] **Step 1: Create `types/standalonePix.ts`**

```ts
export type StandalonePixStatus = 'idle' | 'creating' | 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

export interface StandalonePixPayment {
  id: string;
  source?: 'standalone_pix' | 'pdv_sale' | string;
  public_token?: string | null;
  public_path?: string | null;
  public_url?: string | null;
  local_reference?: string | null;
  cashier_key?: string | null;
  display_id?: string | null;
  mercado_pago_payment_id?: string | null;
  amount: number;
  status: StandalonePixStatus;
  status_label?: string | null;
  description?: string | null;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
  expires_at?: string | null;
  cancel_reason?: string | null;
  shared_phone?: string | null;
  shared_at?: string | null;
  share_channel?: string | null;
  approved_at?: string | null;
  cash_closing_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StandalonePixCreateInput {
  amount: number;
  description?: string;
  cashier_key?: string;
  display_id?: string | null;
  payer_email?: string;
}

export interface StandalonePixListFilters {
  status?: string;
  cashier_key?: string;
  display_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
}

export interface StandalonePixShareResponse extends StandalonePixPayment {
  whatsapp_url: string;
}

export function formatStandalonePixStatus(payment?: Pick<StandalonePixPayment, 'status' | 'status_label' | 'cancel_reason'> | null): string {
  if (!payment) return 'Pendente';
  if (payment.status_label) return payment.status_label;
  if (payment.cancel_reason === 'unpaid_expired' || payment.status === 'expired') return 'Cancelado por falta de pagamento';
  if (payment.status === 'approved') return 'Aprovado';
  if (payment.status === 'rejected') return 'Rejeitado';
  if (payment.status === 'creating' || payment.status === 'pending') return 'Pendente';
  return 'Erro';
}

export function isStandalonePixPayable(payment?: Pick<StandalonePixPayment, 'status' | 'cancel_reason'> | null): boolean {
  if (!payment) return false;
  return !payment.cancel_reason && (payment.status === 'creating' || payment.status === 'pending');
}
```

- [ ] **Step 2: Create `services/standalonePixService.ts`**

```ts
import { vpsClient } from './vpsClient';
import type {
  StandalonePixCreateInput,
  StandalonePixListFilters,
  StandalonePixPayment,
  StandalonePixShareResponse,
} from '../types/standalonePix';

function buildQuery(filters: StandalonePixListFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const standalonePixService = {
  async create(input: StandalonePixCreateInput): Promise<StandalonePixPayment> {
    return vpsClient.post<StandalonePixPayment>('/pix/standalone', input);
  },

  async list(filters: StandalonePixListFilters = {}): Promise<StandalonePixPayment[]> {
    const response = await vpsClient.get<{ data: StandalonePixPayment[] }>('/pix/standalone' + buildQuery(filters));
    return Array.isArray(response.data) ? response.data : [];
  },

  async refreshStatus(id: string): Promise<StandalonePixPayment> {
    return vpsClient.get<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/status`);
  },

  async shareWhatsApp(id: string, phone: string): Promise<StandalonePixShareResponse> {
    return vpsClient.post<StandalonePixShareResponse>(`/pix/standalone/${encodeURIComponent(id)}/share-whatsapp`, { phone });
  },

  async getPublic(token: string): Promise<StandalonePixPayment> {
    return vpsClient.get<StandalonePixPayment>(`/pix/public/${encodeURIComponent(token)}`);
  },
};
```

- [ ] **Step 3: Run frontend static test**

Run: `node tmp-tests/standalone-pix-frontend-static.test.mjs`

Expected: still FAIL because pages/routes/menu are not implemented yet.

---

### Task 6: Admin Pix Avulso Page

**Files:**
- Create: `pages/admin/financial/StandalonePixPage.tsx`
- Test: `tmp-tests/standalone-pix-frontend-static.test.mjs`

- [ ] **Step 1: Create the page component**

Create a focused page using existing styling patterns:

```tsx
import React from 'react';
import { Copy, ExternalLink, MessageCircle, Printer, QrCode, RefreshCw, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { standalonePixService } from '../../../services/standalonePixService';
import { pdvDisplayService } from '../../../services/pdvDisplayService';
import { printPixQr } from '../../../utils/printPixQr';
import { buildPdvPixPrintData } from '../../../services/pdvDisplayService';
import type { PdvDisplay } from '../../../types/pdvDisplay';
import type { StandalonePixPayment } from '../../../types/standalonePix';
import { formatStandalonePixStatus, isStandalonePixPayable } from '../../../types/standalonePix';

function formatCurrency(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toCents(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return Math.round(Number(normalized || 0) * 100);
}

export default function StandalonePixPage() {
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('Pix avulso Mercado do Vale');
  const [cashierKey, setCashierKey] = React.useState(() => localStorage.getItem('standalone_pix_cashier_key') || 'caixa-01');
  const [displayId, setDisplayId] = React.useState(() => localStorage.getItem('standalone_pix_display_id') || '');
  const [phone, setPhone] = React.useState('');
  const [currentPix, setCurrentPix] = React.useState<StandalonePixPayment | null>(null);
  const [payments, setPayments] = React.useState<StandalonePixPayment[]>([]);
  const [displays, setDisplays] = React.useState<PdvDisplay[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const displayOptions = React.useMemo(
    () => displays.filter((display) => display.is_active && (display.type === 'cashier' || display.type === 'hybrid')),
    [displays]
  );

  const loadData = React.useCallback(async () => {
    const [pixRows, displayRows] = await Promise.all([
      standalonePixService.list({ limit: 80, search }),
      pdvDisplayService.listDisplays(),
    ]);
    setPayments(pixRows);
    setDisplays(displayRows);
  }, [search]);

  React.useEffect(() => {
    loadData().catch((error) => {
      console.error('Erro ao carregar Pix avulso:', error);
      toast.error('Erro ao carregar Pix avulso');
    });
  }, [loadData]);

  async function copyText(text?: string | null, label = 'Texto') {
    if (!text) {
      toast.error(`${label} indisponivel`);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  async function handleCreate() {
    const cents = toCents(amount);
    if (cents <= 0) {
      toast.error('Informe um valor para gerar o Pix');
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('standalone_pix_cashier_key', cashierKey.trim() || 'caixa-01');
      localStorage.setItem('standalone_pix_display_id', displayId.trim());
      const pix = await standalonePixService.create({
        amount: cents,
        description: description.trim() || 'Pix avulso Mercado do Vale',
        cashier_key: cashierKey.trim() || 'caixa-01',
        display_id: displayId.trim() || null,
      });
      setCurrentPix(pix);
      await loadData();
      toast.success('Pix Avulso gerado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar Pix Avulso');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(pix = currentPix) {
    if (!pix) return;
    setLoading(true);
    try {
      const updated = await standalonePixService.refreshStatus(pix.id);
      setCurrentPix(updated);
      await loadData();
      toast.success('Status atualizado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar Pix');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisplay(pix = currentPix) {
    if (!pix || !displayId) {
      toast.error('Selecione um Pix e um display');
      return;
    }
    if (!isStandalonePixPayable(pix)) {
      toast.error('Pix aprovado ou cancelado nao pode ir para o display');
      return;
    }
    await pdvDisplayService.setActivePix(displayId, pix.id);
    toast.success('Pix exibido no display');
  }

  async function handleShare() {
    if (!currentPix) {
      toast.error('Gere ou selecione um Pix primeiro');
      return;
    }
    const result = await standalonePixService.shareWhatsApp(currentPix.id, phone);
    setCurrentPix(result);
    window.open(result.whatsapp_url, '_blank');
    await loadData();
  }

  function handlePrint(pix = currentPix) {
    if (!pix) return;
    printPixQr(buildPdvPixPrintData({
      payment: pix as any,
      storeName: 'Mercado do Vale',
      instructions: 'Este Pix avulso vence em 10 minutos.',
    }));
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pix Avulso</h1>
        <p className="text-sm text-slate-500">Gere cobrancas Mercado Pago fora do PDV, com extrato e display.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <QrCode size={18} /> Gerar Pix
          </div>
          <div className="space-y-3">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor em reais" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descricao" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <input value={cashierKey} onChange={(event) => setCashierKey(event.target.value)} placeholder="caixa-01" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <select value={displayId} onChange={(event) => setDisplayId(event.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="">Sem display</option>
              {displayOptions.map((display) => <option key={display.id} value={display.id}>{display.name}</option>)}
            </select>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp do cliente" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={handleCreate} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <QrCode size={16} /> {loading ? 'Gerando...' : 'Gerar Pix'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {currentPix ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                {currentPix.qr_code_base64 && isStandalonePixPayable(currentPix) ? <img src={`data:image/png;base64,${currentPix.qr_code_base64}`} alt="QR Code Pix" className="h-48 w-48 object-contain" /> : <div className="flex h-48 w-48 items-center justify-center text-center text-sm text-slate-500">{formatStandalonePixStatus(currentPix)}</div>}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(currentPix.amount)}</div>
                  <div className="text-sm font-semibold text-cyan-700">{formatStandalonePixStatus(currentPix)}</div>
                  <div className="text-xs text-slate-500">Expira em: {currentPix.expires_at ? new Date(currentPix.expires_at).toLocaleString('pt-BR') : '-'}</div>
                </div>
                <p className="break-all rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">{currentPix.qr_code || 'Pix copia e cola indisponivel'}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copyText(currentPix.qr_code, 'Copiar codigo Pix')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Copy size={14} />Copiar codigo Pix</button>
                  <button onClick={() => copyText(currentPix.public_path, 'Copiar link publico')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><ExternalLink size={14} />Copiar link publico</button>
                  <button onClick={() => handleShare()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><MessageCircle size={14} />Compartilhar no WhatsApp</button>
                  <button onClick={() => handleDisplay()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Smartphone size={14} />Exibir no display</button>
                  <button onClick={() => handleRefresh()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><RefreshCw size={14} />Atualizar</button>
                  <button onClick={() => handlePrint()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Printer size={14} />Imprimir QR</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Gere um Pix Avulso para ver o QR Code.</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">Extrato</h2>
          <div className="flex gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no extrato" className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={() => loadData()} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm font-semibold"><RefreshCw size={14} />Filtrar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Criado</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Caixa</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pix) => (
                <tr key={pix.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{pix.created_at ? new Date(pix.created_at).toLocaleString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2 font-bold">{formatCurrency(pix.amount)}</td>
                  <td className="px-3 py-2">{pix.description}</td>
                  <td className="px-3 py-2">{formatStandalonePixStatus(pix)}</td>
                  <td className="px-3 py-2">{pix.cashier_key || '-'}</td>
                  <td className="px-3 py-2">{pix.shared_phone || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button title="Abrir" onClick={() => setCurrentPix(pix)} className="rounded border p-1"><ExternalLink size={14} /></button>
                      <button title="Atualizar" onClick={() => handleRefresh(pix)} className="rounded border p-1"><RefreshCw size={14} /></button>
                      <button title="Copiar codigo" onClick={() => copyText(pix.qr_code, 'Copiar codigo Pix')} className="rounded border p-1"><Copy size={14} /></button>
                      <button title="Imprimir" onClick={() => handlePrint(pix)} className="rounded border p-1"><Printer size={14} /></button>
                      <button title="Compartilhar" onClick={() => { setCurrentPix(pix); void handleShare(); }} className="rounded border p-1"><Send size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run frontend static test**

Run: `node tmp-tests/standalone-pix-frontend-static.test.mjs`

Expected: still FAIL because public page/routes/menu are not implemented yet.

---

### Task 7: Public Pix Page

**Files:**
- Create: `pages/store/PublicPixPage.tsx`
- Test: `tmp-tests/standalone-pix-frontend-static.test.mjs`

- [ ] **Step 1: Create public token page**

```tsx
import React from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { standalonePixService } from '../../services/standalonePixService';
import type { StandalonePixPayment } from '../../types/standalonePix';
import { formatStandalonePixStatus, isStandalonePixPayable } from '../../types/standalonePix';

function formatCurrency(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PublicPixPage() {
  const { token = '' } = useParams();
  const [pix, setPix] = React.useState<StandalonePixPayment | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadPix = React.useCallback(async () => {
    setLoading(true);
    try {
      setPix(await standalonePixService.getPublic(token));
    } catch (error: any) {
      toast.error(error?.message || 'Pix nao encontrado');
      setPix(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void loadPix();
  }, [loadPix]);

  async function copyCode() {
    if (!pix?.qr_code) {
      toast.error('Pix copia e cola indisponivel');
      return;
    }
    await navigator.clipboard.writeText(pix.qr_code);
    toast.success('Copiar codigo Pix realizado');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-slate-900">Mercado do Vale</h1>
          <p className="text-sm text-slate-500">Pix avulso</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Carregando Pix...</div>
        ) : pix ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-3xl font-black text-slate-900">{formatCurrency(pix.amount)}</div>
              <div className="mt-1 text-sm font-semibold text-cyan-700">{formatStandalonePixStatus(pix)}</div>
              {pix.expires_at && <div className="mt-1 text-xs text-slate-500">Expira em {new Date(pix.expires_at).toLocaleString('pt-BR')}</div>}
            </div>

            <div className="flex justify-center rounded border border-slate-200 bg-slate-50 p-4">
              {pix.qr_code_base64 && isStandalonePixPayable(pix) ? (
                <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="h-64 w-64 object-contain" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-center text-sm font-semibold text-slate-500">
                  Cancelado por falta de pagamento
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-bold text-slate-800">Pix copia e cola</div>
              <p className="break-all rounded bg-slate-50 p-3 font-mono text-xs text-slate-600">{pix.qr_code || 'Codigo indisponivel'}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={copyCode} className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-cyan-600 px-4 py-3 text-sm font-bold text-white">
                <Copy size={16} /> Copiar codigo Pix
              </button>
              <button onClick={loadPix} className="inline-flex items-center justify-center gap-2 rounded border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-slate-500">Pix nao encontrado.</div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run frontend static test**

Run: `node tmp-tests/standalone-pix-frontend-static.test.mjs`

Expected: still FAIL because routes/menu are not wired yet.

---

### Task 8: Routes and Menu

**Files:**
- Modify: `routes/index.tsx`
- Modify: `layouts/AdminLayout.tsx`
- Test: `tmp-tests/standalone-pix-frontend-static.test.mjs`

- [ ] **Step 1: Add lazy imports in `routes/index.tsx`**

Add near the other admin/page lazy imports:

```tsx
const StandalonePixPage = lazy(() => import('../pages/admin/financial/StandalonePixPage'));
const PublicPixPage = lazy(() => import('../pages/store/PublicPixPage'));
```

- [ ] **Step 2: Add public route**

Add near other public routes:

```tsx
  {
    path: "/pix/:token",
    element: <PublicPixPage />
  },
```

- [ ] **Step 3: Add admin route**

Add near `/admin/financeiro`:

```tsx
  {
    path: "/admin/pix-avulso",
    element: (
      <ProtectedRoute requireAdmin={true}>
        <AdminLayout><StandalonePixPage /></AdminLayout>
      </ProtectedRoute>
    )
  },
```

- [ ] **Step 4: Add menu item in `layouts/AdminLayout.tsx`**

In the Financeiro group, add after `Financeiro`:

```tsx
        { to: '/admin/pix-avulso', icon: <QrCode size={18} />, label: 'Pix Avulso', keywords: 'pix mercado pago qr code caixa recebimento avulso' },
```

Also add `QrCode` to the lucide-react import list.

- [ ] **Step 5: Run frontend static test**

Run: `node tmp-tests/standalone-pix-frontend-static.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit frontend pages**

```bash
git add types/standalonePix.ts services/standalonePixService.ts pages/admin/financial/StandalonePixPage.tsx pages/store/PublicPixPage.tsx routes/index.tsx layouts/AdminLayout.tsx tmp-tests/standalone-pix-frontend-static.test.mjs
git commit -m "feat: add standalone pix pages"
```

---

### Task 9: Verification

**Files:**
- Existing test files and build scripts.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node tmp-tests/standalone-pix-backend-static.test.mjs
node tmp-tests/standalone-pix-frontend-static.test.mjs
node tmp-tests/pdv-pix-payment-static.test.mjs
node tmp-tests/pdv-display-routes-static.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run TypeScript check for new frontend files**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: completes without new errors. If existing unrelated TypeScript errors appear, capture the first unrelated file and confirm the new files are not the cause.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds. Existing warnings are acceptable if unrelated.

- [ ] **Step 4: Start dev server for manual check**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite serves the app and `/admin/pix-avulso` is routable after login/dev auth.

- [ ] **Step 5: Commit verification fixes**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize standalone pix verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: page, 10-minute expiration, unpaid cancellation, extract, display, public link, WhatsApp, future `cash_closing_id`, and Google Contacts phase 2 are covered.
- Placeholder scan: no red-flag planning placeholders remain.
- Type consistency: frontend types use `StandalonePixPayment`; backend response returns the same snake_case fields; service methods match page usage.
