# Totem Pix Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Mercado do Vale Pix kiosk flow with a compact display receipt, optional WhatsApp/QR sharing, PDV visual cleanup controls, and a small Android WebView shell for fixed payment devices.

**Architecture:** Extend the existing PDV display backend as the source of truth, then update the display web UI and PDV controls to use the richer receipt state. The Android app stays intentionally thin: it hosts the existing display route in a full-screen WebView and controls screen/brightness behavior for a dedicated kiosk phone.

**Tech Stack:** Fastify/Node in `vps_server.cjs` and `vps_server.js`, MySQL tables managed by existing startup migrations, React/Vite frontend, existing `pdvDisplayService`, Evolution API WhatsApp send helper, Android Kotlin/Gradle WebView shell.

---

## File Structure

- Modify `types/pdvDisplay.ts`: add receipt, share, and temporary-link types.
- Modify `services/pdvDisplayService.ts`: add service methods for clear display, WhatsApp receipt sharing, temporary receipt QR, and public receipt lookup.
- Modify `vps_server.cjs` and `vps_server.js`: add DB tables/columns, receipt mapping, display cleanup, WhatsApp send, and temporary receipt link routes.
- Modify `pages/display/DisplayPage.tsx`: split the display into compact kiosk states and sharing flow components.
- Modify `components/pdv/PaymentSection.tsx`: add PDV buttons for `Compartilhar comprovante` and `Limpar totem`.
- Modify `pages/pdv/PDVPage.tsx`: wire the new payment-section handlers and keep sale finalization separate from display cleanup.
- Create focused tests in `tmp-tests/`: backend route/static tests, display UI static tests, PDV button static tests, WhatsApp text tests, timer tests.
- Create `android/totem-pix/`: minimal Android project wrapping the display URL in a full-screen WebView.
- Update versioning only during publication with `$publish-vps`; do not version or deploy while implementing the feature branch.

## Implementation Notes

- Work with the current dirty worktree. Stage only paths touched by the current task.
- `vps_server.cjs` and `vps_server.js` are duplicated deployment targets; every backend change must land in both unless the repository later confirms one is generated from the other.
- The display token is public-device scoped. Do not return full customer phone numbers from `/pdv/display-state`; use masked phone only there.
- Use the existing `sendDeliveryWhatsappText(phone, text)` helper for WhatsApp sending so credentials remain server-side.
- Use the existing phone normalization pattern based on `normalizeDeliveryWhatsAppNumber`.
- For Mercado Pago authentication, use `raw_response_json.transaction_details.authorization_code`, `raw_response_json.authorization_code`, `raw_response_json.id`, then `mercado_pago_payment_id` as fallback.
- `Limpar totem` clears only display visualization: `pdv_displays.active_pix_payment_id = NULL` and any temporary receipt links invalidated. It must not mutate sale, stock, financial records, payment status, or `pdv_pix_payments.status`.

---

### Task 1: Backend Contract and Migration Guard Tests

**Files:**
- Create: `tmp-tests/pdv-totem-backend-contract-static.test.mjs`
- Create: `tmp-tests/pdv-totem-receipt-core.test.mjs`
- Modify later: `vps_server.cjs`
- Modify later: `vps_server.js`

- [ ] **Step 1: Add the backend static contract test**

Create `tmp-tests/pdv-totem-backend-contract-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const files = ['vps_server.cjs', 'vps_server.js'];

for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS pdv_receipt_share_tokens/, `${file} must create temporary receipt share tokens`);
  assert.match(source, /receipt_share_token_hash/, `${file} must store only hashed receipt share tokens`);
  assert.match(source, /fastify\.post\('\/pdv\/displays\/:displayId\/clear-visual'/, `${file} must expose display-only cleanup`);
  assert.match(source, /fastify\.post\('\/pdv\/pix-payments\/:id\/receipt\/whatsapp'/, `${file} must expose WhatsApp receipt sharing`);
  assert.match(source, /fastify\.post\('\/pdv\/pix-payments\/:id\/receipt\/share-link'/, `${file} must create temporary receipt links`);
  assert.match(source, /fastify\.get\('\/pdv\/receipt-share\/:token'/, `${file} must expose public temporary receipt lookup`);
  assert.match(source, /buildPdvPixReceiptData/, `${file} must centralize receipt data building`);
  assert.match(source, /formatPdvPixReceiptWhatsAppMessage/, `${file} must centralize WhatsApp text formatting`);
  assert.match(source, /maskPdvReceiptPhone/, `${file} must mask customer phone for display state`);
  assert.match(source, /expires_at = DATE_ADD\(NOW\(\), INTERVAL 5 MINUTE\)/, `${file} temporary receipt QR must expire in 5 minutes`);
  assert.match(source, /active_pix_payment_id = NULL/, `${file} clear visual must remove active Pix from display`);
  assert.doesNotMatch(
    source,
    /clear-visual[\s\S]{0,900}(UPDATE sales|UPDATE orders|UPDATE products|INSERT INTO sales|DELETE FROM sales)/,
    `${file} clear visual route must not mutate sale/order/product records`
  );
}

console.log('pdv totem backend contract static checks passed');
```

- [ ] **Step 2: Add the receipt helper unit test**

Create `tmp-tests/pdv-totem-receipt-core.test.mjs` with:

```js
import assert from 'node:assert/strict';

function pickAuthCode(payment) {
  const raw = payment.raw_response || {};
  return String(
    raw?.transaction_details?.authorization_code ||
    raw?.authorization_code ||
    raw?.id ||
    payment.mercado_pago_payment_id ||
    payment.id ||
    ''
  ).trim();
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  const last4 = digits.slice(-4);
  const ddd = digits.startsWith('55') ? digits.slice(2, 4) : digits.slice(0, 2);
  return `(${ddd}) *****-${last4}`;
}

function message(receipt) {
  const greeting = receipt.customer_name ? `Ola, ${receipt.customer_name.split(/\s+/)[0]}!\n\n` : '';
  return `${greeting}Seu pagamento Pix foi aprovado.\n\nPedido: #${receipt.order_number}\nValor: ${receipt.amount_label}\nPagamento: Pix\nAutenticacao: ${receipt.authentication_code}\nData/hora: ${receipt.approved_at_label}\n\nObrigado pela preferencia!\nMercado do Vale`;
}

assert.equal(pickAuthCode({
  id: 'local',
  mercado_pago_payment_id: 'mp-1',
  raw_response: { transaction_details: { authorization_code: 'AUTH-999' } },
}), 'AUTH-999');

assert.equal(pickAuthCode({
  id: 'local',
  mercado_pago_payment_id: 'mp-1',
  raw_response: { id: 12345 },
}), '12345');

assert.equal(maskPhone('+5587988032612'), '(87) *****-2612');
assert.equal(maskPhone('+558788032612'), '(87) *****-2612');

assert.match(message({
  customer_name: 'Maria Silva',
  order_number: '1234',
  amount_label: 'R$ 1.234,56',
  authentication_code: 'AUTH-999',
  approved_at_label: '04/07/2026 15:42',
}), /^Ola, Maria!\n\nSeu pagamento Pix foi aprovado\./);

assert.doesNotMatch(message({
  customer_name: '',
  order_number: '1234',
  amount_label: 'R$ 1.234,56',
  authentication_code: 'AUTH-999',
  approved_at_label: '04/07/2026 15:42',
}), /^Ola,/);

console.log('pdv totem receipt core checks passed');
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run:

```powershell
node tmp-tests\pdv-totem-backend-contract-static.test.mjs
node tmp-tests\pdv-totem-receipt-core.test.mjs
```

Expected:

- First command fails because the backend does not yet have the new routes/table/helpers.
- Second command passes because it locks the desired receipt behavior independently.

- [ ] **Step 4: Commit the failing backend contract tests**

Run:

```powershell
git add tmp-tests/pdv-totem-backend-contract-static.test.mjs tmp-tests/pdv-totem-receipt-core.test.mjs
git commit -m "test: define pix kiosk backend contract"
```

Expected: commit contains only the two new test files.

---

### Task 2: Backend Receipt Data, Share Tokens, and Display Cleanup

**Files:**
- Modify: `vps_server.cjs`
- Modify: `vps_server.js`
- Test: `tmp-tests/pdv-totem-backend-contract-static.test.mjs`
- Test: `tmp-tests/pdv-totem-receipt-core.test.mjs`

- [ ] **Step 1: Add receipt helpers near existing PDV display helpers**

In both `vps_server.cjs` and `vps_server.js`, after `buildPdvPixResponse(row)`, add helpers with these exact responsibilities:

```js
function formatPdvReceiptMoney(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatPdvReceiptDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function pickPdvPixAuthenticationCode(payment) {
  const raw = payment?.raw_response || parsePdvDisplayJson(payment?.raw_response_json, {});
  return String(
    raw?.transaction_details?.authorization_code ||
    raw?.authorization_code ||
    raw?.id ||
    payment?.mercado_pago_payment_id ||
    payment?.id ||
    ''
  ).trim();
}

function maskPdvReceiptPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
  const ddd = withoutCountry.slice(0, 2);
  return `(${ddd}) *****-${digits.slice(-4)}`;
}

function getPdvReceiptFirstName(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean)[0] || '';
}

function buildPdvPixReceiptNumber(payment) {
  const local = String(payment?.local_reference || '').trim();
  const saleDraft = String(payment?.sale_draft_id || '').trim();
  if (local && !local.startsWith('pdv:')) return local.replace(/^pedido[:#-]?/i, '');
  if (saleDraft) return saleDraft;
  return String(payment?.id || '').slice(0, 8);
}

async function buildPdvPixReceiptData(paymentRow, options = {}) {
  const payment = buildPdvPixResponse(paymentRow);
  if (!payment) return null;

  let customer = null;
  if (options.includeCustomer !== false) {
    const saleDraftId = String(payment.sale_draft_id || '').trim();
    const localReference = String(payment.local_reference || '').trim();
    const saleId = saleDraftId || (localReference.startsWith('sale:') ? localReference.slice(5) : '');
    if (saleId) {
      const [sales] = await pool.query('SELECT customer_id, customer_phone FROM sales WHERE id = ? LIMIT 1', [saleId]).catch(() => [[]]);
      const sale = sales?.[0] || null;
      if (sale?.customer_id) {
        const [customers] = await pool.query('SELECT id, name, phone FROM customers WHERE id = ? LIMIT 1', [sale.customer_id]).catch(() => [[]]);
        customer = customers?.[0] || null;
      } else if (sale?.customer_phone) {
        customer = { name: '', phone: sale.customer_phone };
      }
    }
  }

  const approvedAt = payment.updated_at || payment.created_at || new Date().toISOString();
  return {
    pix_payment_id: payment.id,
    order_number: buildPdvPixReceiptNumber(payment),
    amount: Number(payment.amount || 0),
    amount_label: formatPdvReceiptMoney(payment.amount),
    payment_method: 'Pix',
    status: payment.status,
    approved_at: approvedAt,
    approved_at_label: formatPdvReceiptDateTime(approvedAt),
    authentication_code: pickPdvPixAuthenticationCode(payment),
    customer_name: customer?.name || '',
    customer_first_name: getPdvReceiptFirstName(customer?.name || ''),
    customer_phone_masked: maskPdvReceiptPhone(customer?.phone || ''),
    has_customer_phone: Boolean(customer?.phone),
  };
}

function formatPdvPixReceiptWhatsAppMessage(receipt) {
  const firstName = getPdvReceiptFirstName(receipt?.customer_name || '');
  const greeting = firstName ? `Ola, ${firstName}!\n\n` : '';
  return `${greeting}Seu pagamento Pix foi aprovado.\n\nPedido: #${receipt.order_number}\nValor: ${receipt.amount_label}\nPagamento: Pix\nAutenticacao: ${receipt.authentication_code}\nData/hora: ${receipt.approved_at_label}\n\nObrigado pela preferencia!\nMercado do Vale`;
}
```

- [ ] **Step 2: Add startup migration for temporary share tokens**

In the startup migration block near `pdv_pix_payments`, add:

```js
await pool.query(`
  CREATE TABLE IF NOT EXISTS pdv_receipt_share_tokens (
    id CHAR(36) PRIMARY KEY,
    pix_payment_id CHAR(36) NOT NULL,
    receipt_share_token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    opened_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_pdv_receipt_share_token_hash (receipt_share_token_hash),
    INDEX idx_pdv_receipt_share_pix (pix_payment_id),
    INDEX idx_pdv_receipt_share_expires (expires_at),
    INDEX idx_pdv_receipt_share_revoked (revoked_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
```

Also add a `console.log('[migration] pdv receipt share tokens table: OK');` line after it.

- [ ] **Step 3: Extend `display-state` with receipt data**

In both backend files, replace:

```js
active_pix = buildPdvPixResponse(pixRows[0]);
```

with:

```js
active_pix = buildPdvPixResponse(pixRows[0]);
if (active_pix) {
  active_pix.receipt = await buildPdvPixReceiptData(pixRows[0], { includeCustomer: true });
}
```

Ensure the receipt object contains only masked phone and `has_customer_phone`, not the full phone.

- [ ] **Step 4: Add `Limpar totem` backend route**

In both backend files, after `fastify.delete('/pdv/displays/:displayId/active-pix'...)`, add:

```js
fastify.post('/pdv/displays/:displayId/clear-visual', { preHandler: requireSyncKey }, async (req, reply) => {
  const displayId = String(req.params.displayId || '').trim();
  if (!displayId) return reply.code(400).send({ error: 'displayId obrigatorio' });

  const [displayRows] = await pool.query('SELECT active_pix_payment_id FROM pdv_displays WHERE id = ? LIMIT 1', [displayId]);
  const pixPaymentId = displayRows?.[0]?.active_pix_payment_id || null;

  await pool.query('UPDATE pdv_displays SET active_pix_payment_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [displayId]);
  if (pixPaymentId) {
    await pool.query(
      'UPDATE pdv_receipt_share_tokens SET revoked_at = NOW() WHERE pix_payment_id = ? AND revoked_at IS NULL',
      [pixPaymentId]
    );
  }

  return { ok: true, display_id: displayId, pix_payment_id: pixPaymentId };
});
```

- [ ] **Step 5: Add temporary receipt link routes**

In both backend files, after the Pix status route, add:

```js
fastify.post('/pdv/pix-payments/:id/receipt/share-link', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [req.params.id]);
  const payment = rows?.[0] || null;
  if (!payment) return reply.code(404).send({ error: 'Pix nao encontrado' });
  if (String(payment.status) !== 'approved') return reply.code(409).send({ error: 'Comprovante disponivel apenas para Pix aprovado' });

  await pool.query(
    'UPDATE pdv_receipt_share_tokens SET revoked_at = NOW() WHERE pix_payment_id = ? AND revoked_at IS NULL',
    [payment.id]
  );

  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO pdv_receipt_share_tokens (id, pix_payment_id, receipt_share_token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
    [crypto.randomUUID(), payment.id, hashPdvDisplaySecret(token)]
  );

  return reply.code(201).send({
    token,
    url: `https://www.mercadodovale.com.br/receipt-share/${encodeURIComponent(token)}`,
    expires_in_seconds: 300,
  });
});

fastify.get('/pdv/receipt-share/:token', async (req, reply) => {
  const token = String(req.params.token || '').trim();
  if (!token) return reply.code(404).send({ error: 'Comprovante expirado' });

  const [rows] = await pool.query(
    `SELECT st.*, p.*
       FROM pdv_receipt_share_tokens st
       JOIN pdv_pix_payments p ON p.id = st.pix_payment_id
      WHERE st.receipt_share_token_hash = ?
        AND st.revoked_at IS NULL
        AND st.expires_at > NOW()
      LIMIT 1`,
    [hashPdvDisplaySecret(token)]
  );

  const row = rows?.[0] || null;
  if (!row) return reply.code(404).send({ error: 'Comprovante expirado' });
  await pool.query('UPDATE pdv_receipt_share_tokens SET opened_at = COALESCE(opened_at, NOW()) WHERE id = ?', [row.id]);
  const receipt = await buildPdvPixReceiptData(row, { includeCustomer: false });
  return { receipt };
});
```

- [ ] **Step 6: Add WhatsApp receipt route**

In both backend files, after the temporary link routes, add:

```js
fastify.post('/pdv/pix-payments/:id/receipt/whatsapp', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [req.params.id]);
  const payment = rows?.[0] || null;
  if (!payment) return reply.code(404).send({ error: 'Pix nao encontrado' });
  if (String(payment.status) !== 'approved') return reply.code(409).send({ error: 'Comprovante disponivel apenas para Pix aprovado' });

  const receipt = await buildPdvPixReceiptData(payment, { includeCustomer: true });
  const phone = String(req.body?.phone || '').trim();
  const useCustomerPhone = req.body?.use_customer_phone === true;
  let targetPhone = phone;

  if (useCustomerPhone && receipt?.has_customer_phone) {
    const saleId = String(payment.sale_draft_id || '').trim();
    if (saleId) {
      const [sales] = await pool.query('SELECT customer_id, customer_phone FROM sales WHERE id = ? LIMIT 1', [saleId]).catch(() => [[]]);
      const sale = sales?.[0] || null;
      if (sale?.customer_id) {
        const [customers] = await pool.query('SELECT phone FROM customers WHERE id = ? LIMIT 1', [sale.customer_id]).catch(() => [[]]);
        targetPhone = customers?.[0]?.phone || sale.customer_phone || '';
      } else {
        targetPhone = sale?.customer_phone || '';
      }
    }
  }

  if (!targetPhone) return reply.code(400).send({ error: 'telefone obrigatorio' });
  const result = await sendDeliveryWhatsappText(targetPhone, formatPdvPixReceiptWhatsAppMessage(receipt));
  if (!result?.ok) return reply.code(502).send({ error: 'Falha ao enviar WhatsApp', status: result?.status || null });

  return {
    ok: true,
    phone_masked: maskPdvReceiptPhone(targetPhone),
    receipt,
  };
});
```

- [ ] **Step 7: Run backend contract tests**

Run:

```powershell
node tmp-tests\pdv-totem-backend-contract-static.test.mjs
node tmp-tests\pdv-totem-receipt-core.test.mjs
node --check vps_server.cjs
node --check vps_server.js
```

Expected: all commands pass.

- [ ] **Step 8: Commit backend implementation**

Run:

```powershell
git add vps_server.cjs vps_server.js tmp-tests/pdv-totem-backend-contract-static.test.mjs tmp-tests/pdv-totem-receipt-core.test.mjs
git commit -m "feat: add pix kiosk receipt backend"
```

Expected: commit includes backend and focused tests only.

---

### Task 3: Frontend Types and Display Service Methods

**Files:**
- Modify: `types/pdvDisplay.ts`
- Modify: `services/pdvDisplayService.ts`
- Create: `tmp-tests/pdv-totem-service-static.test.mjs`

- [ ] **Step 1: Add frontend service static test**

Create `tmp-tests/pdv-totem-service-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const types = readFileSync('types/pdvDisplay.ts', 'utf8');
const service = readFileSync('services/pdvDisplayService.ts', 'utf8');

for (const token of [
  'PdvPixReceipt',
  'PdvReceiptShareLinkResponse',
  'PdvReceiptWhatsappResponse',
  'receipt?: PdvPixReceipt | null',
]) {
  assert.ok(types.includes(token), `types must include ${token}`);
}

for (const token of [
  'clearDisplayVisual',
  'sharePixReceiptByWhatsapp',
  'createPixReceiptShareLink',
  'getTemporaryPixReceipt',
  '/clear-visual',
  '/receipt/whatsapp',
  '/receipt/share-link',
  '/pdv/receipt-share/',
]) {
  assert.ok(service.includes(token), `service must include ${token}`);
}

console.log('pdv totem service static checks passed');
```

- [ ] **Step 2: Run service test to verify it fails**

Run:

```powershell
node tmp-tests\pdv-totem-service-static.test.mjs
```

Expected: FAIL because new types and methods do not exist.

- [ ] **Step 3: Extend `types/pdvDisplay.ts`**

Add these interfaces above `PdvPixPayment`:

```ts
export interface PdvPixReceipt {
    pix_payment_id: string;
    order_number: string;
    amount: number;
    amount_label: string;
    payment_method: 'Pix';
    status: PdvPixPaymentStatus;
    approved_at?: string | null;
    approved_at_label: string;
    authentication_code: string;
    customer_name?: string | null;
    customer_first_name?: string | null;
    customer_phone_masked?: string | null;
    has_customer_phone?: boolean;
}

export interface PdvReceiptShareLinkResponse {
    token: string;
    url: string;
    expires_in_seconds: number;
}

export interface PdvReceiptWhatsappResponse {
    ok: boolean;
    phone_masked: string;
    receipt: PdvPixReceipt;
}

export interface PdvTemporaryReceiptResponse {
    receipt: PdvPixReceipt;
}
```

Then add this property to `PdvPixPayment`:

```ts
receipt?: PdvPixReceipt | null;
```

- [ ] **Step 4: Extend `services/pdvDisplayService.ts`**

Import the new types and add methods inside `pdvDisplayService`:

```ts
    async clearDisplayVisual(displayId: string): Promise<{ ok: boolean; display_id: string; pix_payment_id?: string | null }> {
        return vpsClient.post(`/pdv/displays/${encodeURIComponent(displayId)}/clear-visual`, {});
    },

    async sharePixReceiptByWhatsapp(
        pixPaymentId: string,
        input: { phone?: string; use_customer_phone?: boolean }
    ): Promise<PdvReceiptWhatsappResponse> {
        return vpsClient.post<PdvReceiptWhatsappResponse>(
            `/pdv/pix-payments/${encodeURIComponent(pixPaymentId)}/receipt/whatsapp`,
            input
        );
    },

    async createPixReceiptShareLink(pixPaymentId: string): Promise<PdvReceiptShareLinkResponse> {
        return vpsClient.post<PdvReceiptShareLinkResponse>(
            `/pdv/pix-payments/${encodeURIComponent(pixPaymentId)}/receipt/share-link`,
            {}
        );
    },

    async getTemporaryPixReceipt(token: string): Promise<PdvTemporaryReceiptResponse> {
        return vpsClient.get<PdvTemporaryReceiptResponse>(`/pdv/receipt-share/${encodeURIComponent(token)}`);
    },
```

- [ ] **Step 5: Run service test**

Run:

```powershell
node tmp-tests\pdv-totem-service-static.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit service contract**

Run:

```powershell
git add types/pdvDisplay.ts services/pdvDisplayService.ts tmp-tests/pdv-totem-service-static.test.mjs
git commit -m "feat: add pix kiosk frontend service contract"
```

Expected: commit contains only type/service/test files.

---

### Task 4: Display UI Compact Kiosk and Sharing Flow

**Files:**
- Modify: `pages/display/DisplayPage.tsx`
- Create: `tmp-tests/pdv-totem-display-ui-static.test.mjs`
- Create: `tmp-tests/pdv-totem-display-timers-static.test.mjs`

- [ ] **Step 1: Add display UI static tests**

Create `tmp-tests/pdv-totem-display-ui-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/display/DisplayPage.tsx', 'utf8');

for (const token of [
  'TOTEM_RECEIPT_VISIBLE_MS',
  'TEMPORARY_RECEIPT_QR_SECONDS',
  'ReceiptView',
  'ReceiptSharePanel',
  'Pedido #',
  'Autenticacao',
  'Compartilhar comprovante',
  'Enviar para meu WhatsApp',
  'Abrir no meu celular por QR Code',
  'Expira em',
  'QR expirado',
]) {
  assert.ok(source.includes(token), `DisplayPage must include ${token}`);
}

assert.match(source, /const TOTEM_RECEIPT_VISIBLE_MS = 10 \* 60 \* 1000;/, 'receipt visual timeout must be 10 minutes');
assert.match(source, /const TEMPORARY_RECEIPT_QR_SECONDS = 5 \* 60;/, 'temporary QR timeout must be 5 minutes');
assert.doesNotMatch(source, /Resumo[\s\S]{0,120}Venda PDV Mercado do Vale/, 'compact Pix mode must not show old sale summary block');

console.log('pdv totem display UI static checks passed');
```

Create `tmp-tests/pdv-totem-display-timers-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/display/DisplayPage.tsx', 'utf8');

assert.match(source, /setTimeout\(\(\) => \{[\s\S]*clearDisplayVisual/, 'display must clear visual state after timeout');
assert.match(source, /shareLinkExpiresAt/, 'display must track share link expiration');
assert.match(source, /Math\.max\(0, Math\.ceil\(\(shareLinkExpiresAt - Date\.now\(\)\) \/ 1000\)\)/, 'display must compute QR countdown seconds');
assert.match(source, /formatCountdown/, 'display must format countdown as mm:ss');

console.log('pdv totem display timer static checks passed');
```

- [ ] **Step 2: Run display tests to verify they fail**

Run:

```powershell
node tmp-tests\pdv-totem-display-ui-static.test.mjs
node tmp-tests\pdv-totem-display-timers-static.test.mjs
```

Expected: FAIL because the display UI is still the old Pix view.

- [ ] **Step 3: Add constants and state to `DisplayPage.tsx`**

Near existing constants, add:

```ts
const TOTEM_RECEIPT_VISIBLE_MS = 10 * 60 * 1000;
const TEMPORARY_RECEIPT_QR_SECONDS = 5 * 60;
```

Inside `DisplayPage`, add state:

```ts
const [shareMode, setShareMode] = useState<'idle' | 'choose' | 'whatsapp' | 'qr' | 'sent'>('idle');
const [manualWhatsapp, setManualWhatsapp] = useState('');
const [shareLoading, setShareLoading] = useState(false);
const [shareLinkUrl, setShareLinkUrl] = useState('');
const [shareLinkExpiresAt, setShareLinkExpiresAt] = useState(0);
const [shareTick, setShareTick] = useState(0);
```

- [ ] **Step 4: Add countdown helper**

Above `DisplayPage`, add:

```ts
function formatCountdown(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
```

- [ ] **Step 5: Add receipt timeout effect**

Inside `DisplayPage`, after polling effects, add:

```ts
useEffect(() => {
    if (!token || !display?.id || active_pix?.status !== 'approved') return;
    const timer = setTimeout(() => {
        pdvDisplayService.clearDisplayVisual(display.id).then(() => {
            setState((current) => current ? { ...current, active_pix: null } : current);
            setShareMode('idle');
            setManualWhatsapp('');
            setShareLinkUrl('');
            setShareLinkExpiresAt(0);
        }).catch((err: any) => setError(err?.message || 'Erro ao limpar totem'));
    }, TOTEM_RECEIPT_VISIBLE_MS);
    return () => clearTimeout(timer);
}, [token, display?.id, active_pix?.id, active_pix?.status]);
```

- [ ] **Step 6: Add QR countdown effect**

Inside `DisplayPage`, add:

```ts
useEffect(() => {
    if (!shareLinkExpiresAt) return;
    const interval = setInterval(() => setShareTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
}, [shareLinkExpiresAt]);
```

- [ ] **Step 7: Replace Pix view rendering**

Change the Pix branch from:

```tsx
<PixView payment={active_pix} display={display} />
```

to:

```tsx
active_pix.status === 'approved' ? (
    <ReceiptView
        payment={active_pix}
        display={display}
        shareMode={shareMode}
        manualWhatsapp={manualWhatsapp}
        shareLoading={shareLoading}
        shareLinkUrl={shareLinkUrl}
        shareLinkSecondsLeft={Math.max(0, Math.ceil((shareLinkExpiresAt - Date.now()) / 1000))}
        onOpenShare={() => setShareMode('choose')}
        onBack={() => setShareMode('idle')}
        onManualWhatsappChange={setManualWhatsapp}
        onSendCustomerWhatsapp={async () => {
            setShareLoading(true);
            try {
                await pdvDisplayService.sharePixReceiptByWhatsapp(active_pix.id, { use_customer_phone: true });
                setShareMode('sent');
            } finally {
                setShareLoading(false);
            }
        }}
        onSendManualWhatsapp={async () => {
            setShareLoading(true);
            try {
                await pdvDisplayService.sharePixReceiptByWhatsapp(active_pix.id, { phone: manualWhatsapp });
                setShareMode('sent');
            } finally {
                setShareLoading(false);
            }
        }}
        onCreateQr={async () => {
            setShareLoading(true);
            try {
                const result = await pdvDisplayService.createPixReceiptShareLink(active_pix.id);
                setShareLinkUrl(result.url);
                setShareLinkExpiresAt(Date.now() + (result.expires_in_seconds || TEMPORARY_RECEIPT_QR_SECONDS) * 1000);
                setShareMode('qr');
            } finally {
                setShareLoading(false);
            }
        }}
    />
) : (
    <PixView payment={active_pix} display={display} />
)
```

- [ ] **Step 8: Simplify compact `PixView`**

Replace the body of `PixView` so pending Pix shows only order number, QR, and amount:

```tsx
function PixView({ payment }: { payment: PdvPixPayment; display: PdvDisplay | null }) {
    const qrImage = payment.qr_code_base64 ? `data:image/png;base64,${payment.qr_code_base64}` : '';
    const orderNumber = payment.receipt?.order_number || payment.local_reference || payment.id.slice(0, 8);

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
            <p className="text-2xl font-black text-blue-100 sm:text-3xl">Pedido #{orderNumber}</p>
            <div className="w-full max-w-[420px] rounded-lg bg-white p-3 text-slate-950 shadow-2xl">
                {qrImage ? (
                    <img src={qrImage} alt="QR Code Pix" className="aspect-square w-full object-contain" />
                ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 p-4 text-center font-mono text-xs break-all">
                        {payment.qr_code}
                    </div>
                )}
            </div>
            <p className="text-5xl font-black tracking-tight text-white sm:text-6xl">{formatCurrency(payment.amount)}</p>
        </div>
    );
}
```

- [ ] **Step 9: Add receipt and sharing components**

Below `PixView`, add `ReceiptView` and `ReceiptSharePanel`. The implementation must render:

```tsx
function ReceiptView(props: {
    payment: PdvPixPayment;
    display: PdvDisplay | null;
    shareMode: 'idle' | 'choose' | 'whatsapp' | 'qr' | 'sent';
    manualWhatsapp: string;
    shareLoading: boolean;
    shareLinkUrl: string;
    shareLinkSecondsLeft: number;
    onOpenShare: () => void;
    onBack: () => void;
    onManualWhatsappChange: (value: string) => void;
    onSendCustomerWhatsapp: () => void;
    onSendManualWhatsapp: () => void;
    onCreateQr: () => void;
}) {
    const receipt = props.payment.receipt;
    const orderNumber = receipt?.order_number || props.payment.local_reference || props.payment.id.slice(0, 8);

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
            <div className="w-full max-w-md rounded-lg border border-emerald-300/30 bg-emerald-500/15 p-5 shadow-2xl">
                <p className="text-3xl font-black text-emerald-200">Pagamento aprovado</p>
                <div className="mt-5 space-y-2 text-left text-xl font-bold text-white">
                    <p>Pedido #{orderNumber}</p>
                    <p>Valor: {receipt?.amount_label || formatCurrency(props.payment.amount)}</p>
                    <p>Pagamento: Pix</p>
                    <p>Autenticacao: {receipt?.authentication_code || props.payment.mercado_pago_payment_id || props.payment.id}</p>
                    <p>Data/hora: {receipt?.approved_at_label || ''}</p>
                    <p>Mercado do Vale</p>
                </div>
                {props.shareMode === 'idle' && (
                    <button type="button" onClick={props.onOpenShare} className="mt-5 w-full rounded-lg bg-white px-4 py-3 text-lg font-black text-emerald-700">
                        Compartilhar comprovante
                    </button>
                )}
                {props.shareMode !== 'idle' && <ReceiptSharePanel {...props} />}
            </div>
        </div>
    );
}
```

`ReceiptSharePanel` must show the two options, the masked customer phone confirmation when `receipt.has_customer_phone` is true, manual phone input, the QR link URL as a QR image if a QR library is available in the project, or a visible URL fallback if not. Use the exact strings from the static test.

- [ ] **Step 10: Run display tests**

Run:

```powershell
node tmp-tests\pdv-totem-display-ui-static.test.mjs
node tmp-tests\pdv-totem-display-timers-static.test.mjs
npm.cmd run build
```

Expected: tests pass and Vite build succeeds.

- [ ] **Step 11: Commit display UI**

Run:

```powershell
git add pages/display/DisplayPage.tsx tmp-tests/pdv-totem-display-ui-static.test.mjs tmp-tests/pdv-totem-display-timers-static.test.mjs
git commit -m "feat: add compact pix kiosk display"
```

Expected: commit contains only display UI and display tests.

---

### Task 5: PDV Controls for Sharing and Cleaning Totem

**Files:**
- Modify: `components/pdv/PaymentSection.tsx`
- Modify: `pages/pdv/PDVPage.tsx`
- Create: `tmp-tests/pdv-totem-pdv-controls-static.test.mjs`

- [ ] **Step 1: Add PDV controls static test**

Create `tmp-tests/pdv-totem-pdv-controls-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const page = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const section = readFileSync('components/pdv/PaymentSection.tsx', 'utf8');

for (const token of [
  'handleClearPdvTotemVisual',
  'handleSharePdvPixReceiptByWhatsapp',
  'pdvDisplayService.clearDisplayVisual',
  'pdvDisplayService.sharePixReceiptByWhatsapp',
]) {
  assert.ok(page.includes(token), `PDVPage must include ${token}`);
}

for (const token of [
  'onClearPdvTotemVisual',
  'onSharePdvPixReceipt',
  'Limpar totem',
  'Compartilhar comprovante',
]) {
  assert.ok(section.includes(token), `PaymentSection must include ${token}`);
}

assert.doesNotMatch(
  page,
  /handleClearPdvTotemVisual[\s\S]{0,900}(createSale|setShowSuccessModal|navigate\(|finalize)/,
  'Limpar totem handler must not finalize sale or navigate away'
);

console.log('pdv totem PDV controls static checks passed');
```

- [ ] **Step 2: Run PDV controls test to verify it fails**

Run:

```powershell
node tmp-tests\pdv-totem-pdv-controls-static.test.mjs
```

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Extend `PaymentSectionProps`**

In `components/pdv/PaymentSection.tsx`, add props:

```ts
    onClearPdvTotemVisual?: () => void;
    onSharePdvPixReceipt?: () => void;
```

Add them to the destructuring list.

- [ ] **Step 4: Add buttons to the Pix Mercado Pago card**

Inside the `pdvPixPayment &&` block, after the status/ticket display and before QR preview, render:

```tsx
{pdvPixPayment.status === 'approved' && (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
            type="button"
            onClick={onSharePdvPixReceipt}
            disabled={pdvPixLoading}
            className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
            Compartilhar comprovante
        </button>
        <button
            type="button"
            onClick={onClearPdvTotemVisual}
            disabled={!pdvPixDisplayId || pdvPixLoading}
            className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
            Limpar totem
        </button>
    </div>
)}
```

- [ ] **Step 5: Add PDV handlers**

In `pages/pdv/PDVPage.tsx`, near the existing Pix handlers, add:

```ts
const handleClearPdvTotemVisual = async () => {
    const displayId = pdvPixDisplayId.trim();
    if (!displayId) {
        toast.error('Selecione o display para limpar o totem');
        return;
    }
    try {
        setPdvPixLoading(true);
        await pdvDisplayService.clearDisplayVisual(displayId);
        toast.success('Totem limpo. A venda e o pagamento continuam preservados.');
    } catch (err: any) {
        toast.error(err?.message || 'Erro ao limpar totem');
    } finally {
        setPdvPixLoading(false);
    }
};

const handleSharePdvPixReceiptByWhatsapp = async () => {
    if (!pdvPixPayment?.id) {
        toast.error('Nenhum Pix aprovado para compartilhar');
        return;
    }
    const phone = selectedCustomer?.phone || window.prompt('WhatsApp para envio do comprovante') || '';
    if (!phone.trim()) return;
    try {
        setPdvPixLoading(true);
        await pdvDisplayService.sharePixReceiptByWhatsapp(pdvPixPayment.id, { phone });
        toast.success('Comprovante enviado por WhatsApp');
    } catch (err: any) {
        toast.error(err?.message || 'Erro ao enviar comprovante');
    } finally {
        setPdvPixLoading(false);
    }
};
```

- [ ] **Step 6: Wire handlers into `PaymentSection`**

Where `PaymentSection` is rendered in `PDVPage.tsx`, pass:

```tsx
onClearPdvTotemVisual={handleClearPdvTotemVisual}
onSharePdvPixReceipt={handleSharePdvPixReceiptByWhatsapp}
```

- [ ] **Step 7: Run PDV tests and build**

Run:

```powershell
node tmp-tests\pdv-totem-pdv-controls-static.test.mjs
npm.cmd run build
```

Expected: test passes and build succeeds.

- [ ] **Step 8: Commit PDV controls**

Run:

```powershell
git add pages/pdv/PDVPage.tsx components/pdv/PaymentSection.tsx tmp-tests/pdv-totem-pdv-controls-static.test.mjs
git commit -m "feat: add pix kiosk controls to pdv"
```

Expected: commit contains only PDV files and test.

---

### Task 6: Public Temporary Receipt Page

**Files:**
- Modify: `routes/index.tsx`
- Create: `pages/display/ReceiptSharePage.tsx`
- Create: `tmp-tests/pdv-receipt-share-page-static.test.mjs`

- [ ] **Step 1: Add receipt page static test**

Create `tmp-tests/pdv-receipt-share-page-static.test.mjs` with:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const routes = readFileSync('routes/index.tsx', 'utf8');
const page = readFileSync('pages/display/ReceiptSharePage.tsx', 'utf8');

assert.match(routes, /\/receipt-share\/:token/, 'routes must expose temporary receipt page');
assert.match(page, /getTemporaryPixReceipt/, 'page must load temporary receipt through service');
assert.match(page, /Comprovante Pix/, 'page must title the receipt');
assert.match(page, /Comprovante expirado/, 'page must handle expired link');
assert.match(page, /Copiar texto/, 'page must allow copying receipt text');
assert.doesNotMatch(page, /customer_phone|telefone completo/i, 'page must not expose full customer phone fields');

console.log('pdv receipt share page static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tmp-tests\pdv-receipt-share-page-static.test.mjs
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Create `ReceiptSharePage.tsx`**

Create a minimal public page:

```tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { pdvDisplayService } from '../../services/pdvDisplayService';
import type { PdvPixReceipt } from '../../types/pdvDisplay';

function buildReceiptText(receipt: PdvPixReceipt): string {
    return [
        'Comprovante Pix',
        `Pedido: #${receipt.order_number}`,
        `Valor: ${receipt.amount_label}`,
        'Pagamento: Pix',
        `Autenticacao: ${receipt.authentication_code}`,
        `Data/hora: ${receipt.approved_at_label}`,
        '',
        'Mercado do Vale',
    ].join('\n');
}

export default function ReceiptSharePage() {
    const { token = '' } = useParams();
    const [receipt, setReceipt] = React.useState<PdvPixReceipt | null>(null);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        pdvDisplayService.getTemporaryPixReceipt(token)
            .then((response) => setReceipt(response.receipt))
            .catch(() => setError('Comprovante expirado'));
    }, [token]);

    if (error) {
        return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-white"><h1 className="text-3xl font-black">{error}</h1></main>;
    }

    if (!receipt) {
        return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">Carregando comprovante...</main>;
    }

    const text = buildReceiptText(receipt);
    return (
        <main className="min-h-screen bg-slate-950 p-6 text-white">
            <section className="mx-auto max-w-md rounded-lg border border-white/10 bg-white/10 p-6">
                <h1 className="text-3xl font-black">Comprovante Pix</h1>
                <pre className="mt-6 whitespace-pre-wrap rounded bg-slate-900 p-4 text-sm leading-relaxed">{text}</pre>
                <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(text)}
                    className="mt-5 w-full rounded bg-white px-4 py-3 font-bold text-slate-950"
                >
                    Copiar texto
                </button>
            </section>
        </main>
    );
}
```

- [ ] **Step 4: Register route**

In `routes/index.tsx`, import:

```ts
const ReceiptSharePage = lazy(() => import('../pages/display/ReceiptSharePage'));
```

Add route:

```tsx
{
  path: "/receipt-share/:token",
  element: <ReceiptSharePage />,
}
```

- [ ] **Step 5: Run page test and build**

Run:

```powershell
node tmp-tests\pdv-receipt-share-page-static.test.mjs
npm.cmd run build
```

Expected: test passes and build succeeds.

- [ ] **Step 6: Commit temporary receipt page**

Run:

```powershell
git add routes/index.tsx pages/display/ReceiptSharePage.tsx tmp-tests/pdv-receipt-share-page-static.test.mjs
git commit -m "feat: add temporary pix receipt page"
```

Expected: commit contains only route/page/test.

---

### Task 7: Android WebView Shell

**Files:**
- Create: `android/totem-pix/settings.gradle`
- Create: `android/totem-pix/build.gradle`
- Create: `android/totem-pix/app/build.gradle`
- Create: `android/totem-pix/app/src/main/AndroidManifest.xml`
- Create: `android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt`
- Create: `tmp-tests/android-totem-pix-static.test.mjs`

- [ ] **Step 1: Add Android static test**

Create `tmp-tests/android-totem-pix-static.test.mjs` with:

```js
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = [
  'android/totem-pix/settings.gradle',
  'android/totem-pix/build.gradle',
  'android/totem-pix/app/build.gradle',
  'android/totem-pix/app/src/main/AndroidManifest.xml',
  'android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt',
];

for (const file of files) assert.ok(existsSync(file), `${file} must exist`);

const manifest = readFileSync('android/totem-pix/app/src/main/AndroidManifest.xml', 'utf8');
const activity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');

assert.match(manifest, /android\.permission\.INTERNET/, 'Android app must request internet');
assert.match(manifest, /android:screenOrientation="portrait"/, 'Totem phone should default to portrait');
assert.match(activity, /WebView/, 'MainActivity must use WebView');
assert.match(activity, /FLAG_KEEP_SCREEN_ON/, 'MainActivity must keep screen on');
assert.match(activity, /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/, 'MainActivity must use immersive fullscreen');
assert.match(activity, /https:\/\/www\.mercadodovale\.com\.br\/display/, 'MainActivity must load production display URL');

console.log('android totem pix static checks passed');
```

- [ ] **Step 2: Run Android static test to verify it fails**

Run:

```powershell
node tmp-tests\android-totem-pix-static.test.mjs
```

Expected: FAIL because the Android project does not exist.

- [ ] **Step 3: Create Gradle settings**

Create `android/totem-pix/settings.gradle`:

```gradle
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = 'MercadoDoValeTotemPix'
include ':app'
```

Create `android/totem-pix/build.gradle`:

```gradle
plugins {
    id 'com.android.application' version '8.6.1' apply false
    id 'org.jetbrains.kotlin.android' version '2.0.21' apply false
}
```

Create `android/totem-pix/app/build.gradle`:

```gradle
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'br.com.mercadodovale.totempix'
    compileSdk 35

    defaultConfig {
        applicationId 'br.com.mercadodovale.totempix'
        minSdk 26
        targetSdk 35
        versionCode 1
        versionName '1.0.0'
    }
}
```

- [ ] **Step 4: Create Android manifest**

Create `android/totem-pix/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="false"
        android:label="Totem Pix"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Also create `android/totem-pix/app/src/main/res/values/styles.xml`:

```xml
<resources>
    <style name="AppTheme" parent="android:style/Theme.Material.NoActionBar">
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowFullscreen">true</item>
    </style>
</resources>
```

- [ ] **Step 5: Create `MainActivity.kt`**

Create `android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt`:

```kotlin
package br.com.mercadodovale.totempix

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()

        webView = WebView(this)
        webView.webViewClient = WebViewClient()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        setContentView(webView)

        webView.loadUrl("https://www.mercadodovale.com.br/display")
    }

    override fun onResume() {
        super.onResume()
        enterImmersiveMode()
    }

    private fun enterImmersiveMode() {
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
}
```

- [ ] **Step 6: Run Android static test**

Run:

```powershell
node tmp-tests\android-totem-pix-static.test.mjs
```

Expected: PASS.

If Android Gradle is installed locally, also run:

```powershell
cd android\totem-pix
.\gradlew.bat assembleDebug
```

Expected: Debug APK builds. If Gradle wrapper is missing, record that APK build was not run locally and the static Android check passed.

- [ ] **Step 7: Commit Android shell**

Run:

```powershell
git add android/totem-pix tmp-tests/android-totem-pix-static.test.mjs
git commit -m "feat: add android pix kiosk shell"
```

Expected: commit contains only Android shell and static test.

---

### Task 8: End-to-End Verification and Publish Readiness

**Files:**
- Modify: `docs/superpowers/specs/2026-07-04-totem-pix-android-design.md` only if a verified implementation detail changed.
- No publication files unless user explicitly asks to publish.

- [ ] **Step 1: Run all focused tests**

Run:

```powershell
node tmp-tests\pdv-totem-backend-contract-static.test.mjs
node tmp-tests\pdv-totem-receipt-core.test.mjs
node tmp-tests\pdv-totem-service-static.test.mjs
node tmp-tests\pdv-totem-display-ui-static.test.mjs
node tmp-tests\pdv-totem-display-timers-static.test.mjs
node tmp-tests\pdv-totem-pdv-controls-static.test.mjs
node tmp-tests\pdv-receipt-share-page-static.test.mjs
node tmp-tests\android-totem-pix-static.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 2: Run existing PDV display tests**

Run:

```powershell
node tmp-tests\pdv-display-routes-static.test.mjs
node tmp-tests\pdv-display-service-static.test.mjs
node tmp-tests\pdv-display-pairing-static.test.mjs
node tmp-tests\pdv-display-approved-pix-timeout-static.test.mjs
node tmp-tests\pdv-pix-payment-static.test.mjs
```

Expected: existing regression tests pass or are intentionally updated in the same task if the old 8-second approved timeout is replaced by the new 10-minute visual-cleanup model.

- [ ] **Step 3: Run syntax and build checks**

Run:

```powershell
node --check vps_server.cjs
node --check vps_server.js
npm.cmd run build
```

Expected: syntax checks pass and Vite build succeeds.

- [ ] **Step 4: Manual local smoke checklist**

Run app locally if feasible:

```powershell
npm.cmd run dev
```

Verify in browser:

- `/display` still opens pairing screen without token.
- Approved Pix state renders receipt with order number, value, authentication, date/time, Mercado do Vale.
- `Compartilhar comprovante` opens WhatsApp and QR choices.
- QR screen shows `Expira em 04:59` or lower.
- PDV Pix panel shows `Compartilhar comprovante` and `Limpar totem` only for approved Pix.

- [ ] **Step 5: Commit final adjustments if needed**

If any test required a small correction, stage only those corrected paths:

```powershell
git add <explicit paths>
git commit -m "fix: stabilize pix kiosk flow"
```

Expected: no unrelated worktree files are staged.

- [ ] **Step 6: Prepare publication handoff**

Do not publish here unless the user explicitly says to publish. When publishing is requested, use `$publish-vps`, read `publicar.md`, then run:

```powershell
npm.cmd run publish:vps-plan -- --slug totem-pix-android --summary "Totem Pix Android com comprovante e compartilhamento"
```

Expected: publication plan classifies this as site + API, and the publication flow handles version files, commit/tag/push/deploy/validation.

---

## Self-Review

Spec coverage:

- Android fixed kiosk and optional mobile displays: Task 7.
- Existing display backend reuse: Tasks 2 and 3.
- Pending Pix compact screen: Task 4.
- Approved receipt with order number, value, authentication, date/time: Tasks 2 and 4.
- `Limpar totem` separate from sale finalization: Tasks 2 and 5.
- 10-minute visual cleanup: Task 4.
- WhatsApp sharing with customer/manual phone: Tasks 2, 3, 4, and 5.
- Temporary QR with 5-minute countdown: Tasks 2, 3, 4, and 6.
- Public link only for current operation and expiry on cleanup: Tasks 2 and 6.
- Publish only through `$publish-vps`: Task 8.

Placeholder scan:

- No placeholder markers or deferred-implementation notes are present.
- Every task includes exact files, concrete commands, expected results, and implementation snippets.

Type consistency:

- `PdvPixReceipt`, `PdvReceiptShareLinkResponse`, `PdvReceiptWhatsappResponse`, and `PdvTemporaryReceiptResponse` are defined before service methods use them.
- Backend uses `buildPdvPixReceiptData`, `formatPdvPixReceiptWhatsAppMessage`, and `maskPdvReceiptPhone` consistently across display state, WhatsApp, and public share routes.
