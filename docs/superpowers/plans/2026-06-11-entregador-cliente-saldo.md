# Entregador Cliente Saldo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform a customer record into a reusable delivery-person profile, create a delivery operation link for each sale with delivery, collect Pix through the delivery flow, require proof photo, and only then record payable balance for the delivery person.

**Architecture:** Keep `customers` as the person identity and add delivery-specific operation, proof, and ledger tables instead of maintaining a second person record in `team_members`. PDV will create a pending delivery operation and secure link when a selected delivery person has a linked customer id; the payable ledger is created only after Mercado Pago confirms Pix, the delivery person uploads proof photo, and marks the delivery as successful. The customer profile will show an admin-only delivery tab with delivery history, payable balance, manual payment registration, and offset against customer debts.

**Tech Stack:** React + TypeScript frontend, Vite, Fastify VPS API in `vps_server.js`/`vps_server.cjs`, MySQL migrations inside VPS startup, existing `vpsClient`, existing customer debt service patterns.

## Implantation Checklist And Production Diary

- [x] 2026-06-11: Plano localizado em `docs/superpowers/plans/2026-06-11-entregador-cliente-saldo.md`.
- [x] 2026-06-11: Restricao confirmada: nao usar Supabase nem Vercel; implantacao deve seguir VPS propria, Fastify, MySQL e Synology.
- [x] 2026-06-11: Teste estatico RED criado em `tmp-tests/customer-delivery-ledger-static.test.mjs`.
- [x] Backend VPS: criar tabelas, campos de venda, job pendente, Pix da entrega, proof, conclusao e ledger.
- [x] Frontend PDV: permitir entregador vinculado a cliente e enviar `delivery_person_customer_id`.
- [x] Frontend entrega: pagina por token com Pix, consulta, rota, contato, upload comprimido e conclusao.
- [x] Perfil cliente/admin: aba `Entregas` com historico, saldo, pagamento manual e abatimento em debitos.
- [x] Verificacao: `node --check vps_server.js`, `node --check vps_server.cjs`, `npm.cmd run test:customer-delivery`, `npm.cmd run build`.
- [x] Limpeza: `package-lock.json` restaurado apos `npm install`; `node_modules/` e `dist/` confirmados como ignorados pelo Git; alteracoes existentes do usuario preservadas.
- [x] Browser local: dev server sobe em primeiro plano, mas o sandbox nao manteve processo em background para navegacao; validacao visual ficou pendente e build validou o bundle.

---

## File Structure

- Modify `vps_server.js` and `vps_server.cjs`: add migrations, helper functions, and endpoints for delivery customer profile, delivery operations, Pix intent, proof upload, completion, ledger entries, payments, and debt offsets.
- Modify `services/customerDeliveryService.ts`: new frontend service for delivery profile, delivery operation link/status, ledger, payments, and offsets.
- Modify `services/saleService.ts` and `types/sale.ts`: make sale creation carry `delivery_person_customer_id` when a customer-backed delivery person is selected.
- Modify `pages/pdv/PDVPage.tsx`: select a customer as delivery person and send that id on sale finalize.
- Create `pages/delivery/DeliveryOperationPage.tsx`: secure delivery link opened by the delivery person; shows receipt-style sale data, address, Pix QR, proof upload, and finish action.
- Modify `pages/customer/CustomerProfilePage.tsx`: add admin-visible `Entregas` tab when the customer is a delivery person.
- Create `components/customer/profile/DeliveryWorkerTab.tsx`: delivery history, payable balance, payment form, debt offset form.
- Create `tmp-tests/customer-delivery-ledger-static.test.mjs`: static regression checks for migrations, endpoints, PDV payload, tab, and UI labels.
- Modify `package.json`: add `test:customer-delivery`.

---

## Critical Flow Correction

The sale finalization must not immediately credit the delivery person. It must create a `customer_delivery_jobs` row with status `pending`. The payable entry in `customer_delivery_ledger` is created only after all of these are true:

1. The sale has delivery enabled and a customer-backed delivery person selected.
2. The delivery person opens the generated link.
3. The page shows the purchase data like the customer receipt, plus full delivery address.
4. The page generates or loads a Mercado Pago Pix QR for the amount chosen by the customer/admin for that delivery operation.
5. Mercado Pago webhook confirms the Pix as paid. The page must also poll the job payment status every 10 seconds while payment is pending, so it behaves like the user is pressing a manual `Consultar pagamento` button until only that payment updates.
6. The delivery person uploads a compressed proof photo to Synology, such as the customer holding the purchase or the front of the delivery address.
7. The delivery person taps `Entrega realizada com sucesso`.
8. The system marks the operation complete, creates the delivery ledger credit, records the history in the delivery person's customer profile, and also records the proof photo in the buyer customer's delivery history.

The delivery history row must include, at minimum:

- `Numero do Pedido`
- `Nome do cliente`
- `Endereco completo da entrega`
- `Hiperlink de rota para o endereco`
- `Data e hora da entrega`
- `Valor da entrega`
- `Foto de comprovacao`
- `URL Synology da foto comprimida`
- `Observacao do entregador` apenas para uso interno
- `Status do Pix`
- `Status da entrega`

This same delivery proof must appear in two customer contexts:

- Buyer customer page: `Entrega recebida`, tied to the order, with proof photo, full address, and delivery timestamp.
- Delivery-person customer page: `Entrega realizada`, tied to the same order, with proof photo, delivery timestamp, delivery amount, payable/settlement status, and the delivery person's internal note.

The delivery person can type an optional observation before marking the delivery as successful. This note must be saved in the general delivery record and in the delivery person's customer history, but it must not appear in the buyer customer's page/history.

The proof photo must be compressed before upload so the Synology storage does not grow unnecessarily. Use the existing frontend utility `utils/image-compression.ts` and upload the compressed file through the existing VPS Synology endpoint `/synology/upload?folder=imagens`. Store the returned CDN URL in the delivery proof row and expose it in both:

- the delivery person's `Entregas` tab, as proof of the delivery that generated payable balance;
- the buyer customer's history, as proof that their purchase was delivered.

Do not upload or store the same image twice. Upload one compressed image to Synology and store one proof row with both `buyer_customer_id` and `delivery_person_customer_id`; both customer pages must reference that same `image_url`.

Before upload, the system must rename the compressed file with a canonical, path-safe name based on the order number so the Synology path is predictable and easy to audit:

```ts
function buildDeliveryProofFileName(orderNumber: string, jobId: string, originalName: string): string {
  const safeOrder = String(orderNumber || 'pedido').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const safeJob = String(jobId || '').replace(/[^a-zA-Z0-9-]+/g, '').slice(0, 8);
  const ext = originalName.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `entrega-${safeOrder}-${safeJob}-${stamp}.${ext}`;
}
```

Example:

```txt
entrega-pdv-20260611-001-bc3f7f14-20260611235910.jpg
```

Pix QR expiration rule: the delivery Pix must have an explicit `expires_at`/`date_of_expiration`. Use the same operational default already used in the customer debt Pix flow: 24 hours after creation. Store this timestamp in `customer_delivery_jobs.pix_expires_at`, show it on the delivery page, and block completion/regeneration correctly if the Pix expires before payment.

Payment confirmation rule:

- The Mercado Pago webhook is the source of truth and must update `customer_delivery_jobs.payment_status = 'approved'` when `metadata.flow === 'delivery_job'` or `external_reference === 'delivery_job:<job_id>'`.
- The delivery page must include a visible `Consultar pagamento` action for manual recovery.
- While `payment_status` is `pending`, the page must run a background interval every 10 seconds that calls the same status endpoint used by the button.
- The polling must stop when the job becomes `approved`, `failed`, `cancelled`, `delivered`, or when the component unmounts.
- The polling must update only the current delivery job/payment, not global sale/order state.

Delivery route hyperlink rule:

- Generate `delivery_route_url` only after the residence number is known and the full delivery address can be assembled.
- When creating the delivery job, store `delivery_address_text`, including street, residence number, neighborhood, city, state, CEP, and complement/reference when available.
- When a CEP is available, query the existing BrasilAPI CEP v2 integration to enrich the job with location/address data.
- Add `delivery_route_url` to `customer_delivery_jobs`.
- Prefer a coordinate link when BrasilAPI returns coordinates; otherwise build a Google Maps search URL from the full address.
- The delivery operation page must show a button/link `Abrir rota` for the delivery person.
- If the residence number is missing, do not generate the route link yet; the delivery operation must show that the address is incomplete and block dispatch until the number is filled.

```ts
function buildDeliveryRouteUrl(addressText: string, location?: { latitude?: number; longitude?: number }): string {
  if (location?.latitude && location?.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
}
```

Customer contact action rule:

- Store the buyer customer's phone on the delivery job snapshot as `buyer_phone`.
- The delivery operation page must show `Falar no WhatsApp` using `https://wa.me/55<digits>` when the buyer phone exists.
- The delivery operation page must show `Ligar para cliente` using `tel:<digits>` when the buyer phone exists.
- If the buyer phone is missing, show the contact area as unavailable for the delivery person and expose it as a data problem for admin review.

---

### Task 1: Data Model And API Contract

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/customer-delivery-ledger-static.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing static test**

Create `tmp-tests/customer-delivery-ledger-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vps = readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const pdv = readFileSync(new URL('../pages/pdv/PDVPage.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../pages/customer/CustomerProfilePage.tsx', import.meta.url), 'utf8');
const deliveryPage = readFileSync(new URL('../pages/delivery/DeliveryOperationPage.tsx', import.meta.url), 'utf8');

assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_profiles/, 'VPS must create customer delivery profile table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_jobs/, 'VPS must create delivery operation table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_proofs/, 'VPS must create delivery proof photo table');
assert.match(vps, /buyer_customer_id/, 'Delivery proof must be linked to the buyer customer');
assert.match(vps, /delivery_person_customer_id/, 'Delivery proof must be linked to the delivery customer');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_ledger/, 'VPS must create delivery ledger table');
assert.match(vps, /CREATE TABLE IF NOT EXISTS customer_delivery_settlements/, 'VPS must create delivery settlement table');
assert.match(vps, /fastify\.get\('\/delivery\/jobs\/:token'/, 'VPS must expose a tokenized delivery operation');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/pix-intent'/, 'VPS must generate Pix for delivery operation');
assert.match(vps, /metadata\.flow === 'delivery_job'|flow: 'delivery_job'/, 'Mercado Pago webhook must support delivery job payments');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/payment-status'/, 'VPS must expose delivery payment status refresh endpoint');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/proof'/, 'VPS must accept delivery proof photo');
assert.match(vps, /fastify\.post\('\/delivery\/jobs\/:token\/complete'/, 'VPS must complete successful delivery');
assert.match(vps, /fastify\.get\('\/customers\/:customerId\/delivery-ledger'/, 'VPS must list customer delivery ledger');
assert.match(vps, /fastify\.post\('\/customers\/:customerId\/delivery-payments'/, 'VPS must register delivery payments');
assert.match(vps, /fastify\.post\('\/customers\/:customerId\/delivery-offsets'/, 'VPS must offset delivery balance against debts');
assert.match(vps, /createCustomerDeliveryJobForSale/, 'Sale creation must create pending delivery jobs');
assert.match(vps, /completeCustomerDeliveryJob/, 'Delivery completion must create ledger entries');
assert.match(pdv, /delivery_person_customer_id/, 'PDV must send linked delivery customer id');
assert.match(profile, /DeliveryWorkerTab/, 'Customer profile must render delivery worker tab');
assert.match(deliveryPage, /compressImage/, 'Delivery operation page must compress proof photos before upload');
assert.match(deliveryPage, /buildDeliveryProofFileName/, 'Delivery operation page must rename proof photo with order number before upload');
assert.match(deliveryPage, /Consultar pagamento/, 'Delivery operation page must expose manual payment status refresh');
assert.match(deliveryPage, /setInterval\([^)]*10000|10_000/, 'Delivery operation page must poll pending payment every 10 seconds');
assert.match(deliveryPage, /Abrir rota/, 'Delivery operation page must show a route hyperlink');
assert.match(deliveryPage, /Falar no WhatsApp/, 'Delivery operation page must let delivery person contact buyer by WhatsApp');
assert.match(deliveryPage, /Ligar para cliente/, 'Delivery operation page must let delivery person call buyer');
assert.match(deliveryPage, /\/synology\/upload\?folder=imagens/, 'Delivery proof upload must use Synology image storage');
assert.match(deliveryPage, /Entrega realizada com sucesso/, 'Delivery operation page must expose the completion action');

console.log('customer delivery ledger static checks passed');
```

- [ ] **Step 2: Add the package script**

Add to `package.json` scripts:

```json
"test:customer-delivery": "node tmp-tests/customer-delivery-ledger-static.test.mjs"
```

- [ ] **Step 3: Run the test and confirm it fails**

Run:

```powershell
npm.cmd run test:customer-delivery
```

Expected: FAIL on missing `customer_delivery_profiles`.

- [ ] **Step 4: Add migrations in both VPS files**

Add in the migration area near `customer_debts`:

```js
await pool.query(`
  CREATE TABLE IF NOT EXISTS customer_delivery_profiles (
    customer_id VARCHAR(255) PRIMARY KEY,
    active TINYINT(1) NOT NULL DEFAULT 1,
    default_delivery_fee BIGINT NOT NULL DEFAULT 0,
    pix_key VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_delivery_profiles_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS customer_delivery_jobs (
    id CHAR(36) PRIMARY KEY,
    token VARCHAR(96) NOT NULL,
    sale_id VARCHAR(36) NOT NULL,
    order_number VARCHAR(80) NULL,
    buyer_customer_id VARCHAR(255) NULL,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(40) NULL,
    delivery_person_customer_id VARCHAR(255) NOT NULL,
    delivery_amount BIGINT NOT NULL DEFAULT 0,
    payment_amount BIGINT NOT NULL DEFAULT 0,
    payment_status ENUM('not_required','pending','approved','failed','cancelled') NOT NULL DEFAULT 'pending',
    delivery_status ENUM('pending','in_route','delivered','cancelled') NOT NULL DEFAULT 'pending',
    delivery_address_text TEXT NOT NULL,
    receipt_snapshot_json JSON NOT NULL,
    mercado_pago_payment_id VARCHAR(120) NULL,
    qr_code MEDIUMTEXT NULL,
    qr_code_base64 MEDIUMTEXT NULL,
    ticket_url TEXT NULL,
    pix_expires_at DATETIME NULL,
    delivery_route_url TEXT NULL,
    delivered_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_customer_delivery_jobs_token (token),
    UNIQUE KEY uniq_customer_delivery_jobs_sale (sale_id),
    INDEX idx_customer_delivery_jobs_delivery_person (delivery_person_customer_id),
    INDEX idx_customer_delivery_jobs_sale (sale_id),
    INDEX idx_customer_delivery_jobs_status (delivery_status, payment_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS customer_delivery_proofs (
    id CHAR(36) PRIMARY KEY,
    job_id CHAR(36) NOT NULL,
    buyer_customer_id VARCHAR(255) NULL,
    delivery_person_customer_id VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    original_file_name VARCHAR(255) NULL,
    compressed_size_bytes INT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_delivery_proofs_job (job_id),
    INDEX idx_customer_delivery_proofs_buyer (buyer_customer_id),
    INDEX idx_customer_delivery_proofs_delivery_person (delivery_person_customer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS customer_delivery_ledger (
    id CHAR(36) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    job_id CHAR(36) NULL,
    sale_id VARCHAR(36) NULL,
    order_number VARCHAR(80) NULL,
    buyer_name VARCHAR(255) NULL,
    delivery_address_text TEXT NULL,
    proof_image_url TEXT NULL,
    delivery_person_note TEXT NULL,
    amount BIGINT NOT NULL,
    description TEXT NOT NULL,
    status ENUM('open','settled','cancelled') NOT NULL DEFAULT 'open',
    delivered_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_customer_delivery_ledger_sale (sale_id),
    INDEX idx_customer_delivery_ledger_job (job_id),
    INDEX idx_customer_delivery_ledger_customer (customer_id),
    INDEX idx_customer_delivery_ledger_status (status),
    INDEX idx_customer_delivery_ledger_delivered (delivered_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS customer_delivery_settlements (
    id CHAR(36) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    ledger_id CHAR(36) NULL,
    debt_id CHAR(36) NULL,
    type ENUM('payment','debt_offset') NOT NULL,
    amount BIGINT NOT NULL,
    paid_at DATETIME NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_delivery_settlements_customer (customer_id),
    INDEX idx_customer_delivery_settlements_ledger (ledger_id),
    INDEX idx_customer_delivery_settlements_debt (debt_id),
    INDEX idx_customer_delivery_settlements_paid_at (paid_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
```

- [ ] **Step 5: Add sale delivery-job helper and read endpoints**

Add helpers:

```js
function normalizeDeliveryLedgerAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

async function createCustomerDeliveryJobForSale(connection, sale) {
  const customerId = String(sale.delivery_person_customer_id || '').trim();
  const amount = normalizeDeliveryLedgerAmount(sale.delivery_total || sale.delivery_cost_store || 0);
  if (!customerId || amount <= 0) return null;

  const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  await connection.query(
    `INSERT INTO customer_delivery_jobs
      (id, token, sale_id, order_number, buyer_customer_id, buyer_name, delivery_person_customer_id,
       buyer_phone, delivery_amount, payment_amount, delivery_address_text, delivery_route_url, receipt_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       buyer_phone = VALUES(buyer_phone),
       delivery_person_customer_id = VALUES(delivery_person_customer_id),
       delivery_amount = VALUES(delivery_amount),
       payment_amount = VALUES(payment_amount),
       delivery_address_text = VALUES(delivery_address_text),
       delivery_route_url = VALUES(delivery_route_url),
       receipt_snapshot_json = VALUES(receipt_snapshot_json),
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      token,
      sale.id,
      sale.order_number || sale.numero || String(sale.id).slice(0, 8),
      sale.customer_id || null,
      sale.customer_name || 'Cliente',
      customerId,
      sale.buyer_phone || sale.customer_phone || null,
      amount,
      normalizeDeliveryLedgerAmount(sale.payment_amount || sale.total || 0),
      sale.delivery_address_text,
      sale.delivery_route_url || buildDeliveryRouteUrl(sale.delivery_address_text),
      JSON.stringify(sale.receipt_snapshot || {})
    ]
  );
  return { id, token, delivery_person_customer_id: customerId, sale_id: sale.id, delivery_amount: amount };
}

async function completeCustomerDeliveryJob(connection, job, proof) {
  const ledgerId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  await connection.query(
    `INSERT INTO customer_delivery_ledger
      (id, customer_id, job_id, sale_id, order_number, buyer_name, delivery_address_text, proof_image_url, delivery_person_note, amount, description, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      ledgerId,
      job.delivery_person_customer_id,
      job.id,
      job.sale_id,
      job.order_number,
      job.buyer_name,
      job.delivery_address_text,
      proof.image_url,
      job.delivery_person_note || null,
      job.delivery_amount,
      `Entrega realizada - Pedido ${job.order_number || String(job.sale_id).slice(0, 8)}`
    ]
  );
  await connection.query(
    "UPDATE customer_delivery_jobs SET delivery_status = 'delivered', delivered_at = NOW() WHERE id = ?",
    [job.id]
  );
  return ledgerId;
}
```

Add endpoints:

```js
fastify.get('/customers/:customerId/delivery-ledger', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const customerId = String(req.params.customerId || '').trim();
  const [ledger] = await pool.query(
    'SELECT * FROM customer_delivery_ledger WHERE customer_id = ? ORDER BY delivered_at DESC, created_at DESC LIMIT 300',
    [customerId]
  );
  const [settlements] = await pool.query(
    'SELECT * FROM customer_delivery_settlements WHERE customer_id = ? ORDER BY paid_at DESC, created_at DESC LIMIT 300',
    [customerId]
  );
  const openCents = ledger
    .filter((row) => row.status === 'open')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const settledCents = settlements.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { ledger, settlements, summary: { open_cents: Math.max(0, openCents - settledCents), earned_cents: openCents, settled_cents: settledCents } };
});

fastify.get('/delivery/jobs/:token', async (req, reply) => {
  const token = String(req.params.token || '').trim();
  const [[job]] = await pool.query('SELECT * FROM customer_delivery_jobs WHERE token = ? LIMIT 1', [token]);
  if (!job) return reply.code(404).send({ error: 'Entrega nao encontrada' });
  const [proofs] = await pool.query('SELECT * FROM customer_delivery_proofs WHERE job_id = ? ORDER BY created_at DESC', [job.id]);
  return { job, proofs };
});

fastify.post('/delivery/jobs/:token/pix-intent', async (req, reply) => {
  // Implement using the existing Mercado Pago payment creation pattern.
  // external_reference must be `delivery_job:${job.id}` and metadata.flow must be `delivery_job`.
  // Set date_of_expiration to now + 24h unless the admin explicitly chose a shorter expiration.
  // Save qr_code, qr_code_base64, ticket_url, mercado_pago_payment_id, pix_expires_at, and payment_status='pending' on customer_delivery_jobs.
});

fastify.post('/delivery/jobs/:token/payment-status', async (req, reply) => {
  // Query Mercado Pago for the current payment id and update only this customer_delivery_jobs row.
  // This endpoint powers both the manual "Consultar pagamento" button and the 10-second polling loop.
  // Return { payment_status, mercado_pago_payment_id, approved_at, pix_expires_at }.
});

fastify.post('/delivery/jobs/:token/proof', async (req, reply) => {
  const token = String(req.params.token || '').trim();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const imageUrl = String(body.image_url || '').trim();
  if (!imageUrl) return reply.code(400).send({ error: 'image_url obrigatoria' });
  const [[job]] = await pool.query('SELECT * FROM customer_delivery_jobs WHERE token = ? LIMIT 1', [token]);
  if (!job) return reply.code(404).send({ error: 'Entrega nao encontrada' });
  const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO customer_delivery_proofs
      (id, job_id, buyer_customer_id, delivery_person_customer_id, image_url, original_file_name, compressed_size_bytes, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      job.id,
      job.buyer_customer_id || null,
      job.delivery_person_customer_id,
      imageUrl,
      body.original_file_name || null,
      body.compressed_size_bytes || null,
      body.description || 'Comprovante de entrega'
    ]
  );
  return reply.code(201).send({ id, job_id: job.id, image_url: imageUrl });
});

fastify.post('/delivery/jobs/:token/complete', async (req, reply) => {
  // Require payment_status = 'approved' and at least one proof photo before calling completeCustomerDeliveryJob.
  // Save req.body.delivery_person_note on customer_delivery_jobs before completing.
  // Expose delivery_person_note only to admin/internal delivery views and the delivery person's history.
  // Do not include delivery_person_note in the buyer customer's delivery proof payload.
});
```

- [ ] **Step 6: Add payment and offset endpoints**

```js
fastify.post('/customers/:customerId/delivery-payments', { preHandler: requireSyncKey }, async (req, reply) => {
  const customerId = String(req.params.customerId || '').trim();
  const amount = normalizeDeliveryLedgerAmount(req.body?.amount);
  const description = String(req.body?.description || '').trim();
  const paidAt = req.body?.paid_at || new Date().toISOString();
  if (!customerId) return reply.code(400).send({ error: 'customer_id obrigatorio' });
  if (amount <= 0) return reply.code(400).send({ error: 'valor invalido' });
  if (!description) return reply.code(400).send({ error: 'descricao obrigatoria' });

  const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO customer_delivery_settlements
      (id, customer_id, type, amount, paid_at, description)
     VALUES (?, ?, 'payment', ?, ?, ?)`,
    [id, customerId, amount, paidAt, description]
  );
  return reply.code(201).send({ id, customer_id: customerId, type: 'payment', amount, paid_at: paidAt, description });
});

fastify.post('/customers/:customerId/delivery-offsets', { preHandler: requireSyncKey }, async (req, reply) => {
  const customerId = String(req.params.customerId || '').trim();
  const debtId = String(req.body?.debt_id || '').trim();
  const amount = normalizeDeliveryLedgerAmount(req.body?.amount);
  const description = String(req.body?.description || 'Abatimento com saldo de entregas').trim();
  if (!customerId) return reply.code(400).send({ error: 'customer_id obrigatorio' });
  if (!debtId) return reply.code(400).send({ error: 'debt_id obrigatorio' });
  if (amount <= 0) return reply.code(400).send({ error: 'valor invalido' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[debt]] = await connection.query('SELECT * FROM customer_debts WHERE id = ? AND customer_id = ? FOR UPDATE', [debtId, customerId]);
    if (!debt) throw Object.assign(new Error('Debito nao encontrado'), { statusCode: 404 });
    if (amount > Number(debt.saldo_devedor || 0)) throw Object.assign(new Error('Valor excede saldo devedor'), { statusCode: 400 });

    const paymentId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    const settlementId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    const paidAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await connection.query(
      `INSERT INTO customer_debt_payments (id, debt_id, valor_pago, data_pagamento, metodo_pagamento, observacoes)
       VALUES (?, ?, ?, CURDATE(), 'saldo_entregas', ?)`,
      [paymentId, debtId, amount, description]
    );
    const novoSaldo = Number(debt.saldo_devedor || 0) - amount;
    await connection.query('UPDATE customer_debts SET saldo_devedor = ?, status = ? WHERE id = ?', [novoSaldo, novoSaldo <= 0 ? 'paid' : 'partial', debtId]);
    await connection.query(
      `INSERT INTO customer_delivery_settlements (id, customer_id, debt_id, type, amount, paid_at, description)
       VALUES (?, ?, ?, 'debt_offset', ?, ?, ?)`,
      [settlementId, customerId, debtId, amount, paidAt, description]
    );
    await connection.commit();
    return reply.code(201).send({ id: settlementId, customer_id: customerId, debt_id: debtId, type: 'debt_offset', amount, debt_payment_id: paymentId });
  } catch (err) {
    await connection.rollback();
    return reply.code(err.statusCode || 500).send({ error: err.message || 'Erro ao abater saldo de entregas' });
  } finally {
    connection.release();
  }
});
```

- [ ] **Step 7: Run backend syntax checks**

Run:

```powershell
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run test:customer-delivery
```

Expected: all pass.

---

### Task 2: PDV Delivery Person Selection

**Files:**
- Modify: `types/sale.ts`
- Modify: `services/saleService.ts`
- Modify: `pages/pdv/PDVPage.tsx`
- Test: `tmp-tests/customer-delivery-ledger-static.test.mjs`

- [ ] **Step 1: Add sale input field**

In `types/sale.ts`, add:

```ts
delivery_person_customer_id?: string | null;
```

to `SaleInput`.

- [ ] **Step 2: Preserve field in sale service payload**

In `services/saleService.ts`, ensure `createSale(input)` sends:

```ts
delivery_person_customer_id: input.delivery_person_customer_id || null,
```

- [ ] **Step 3: In PDV, store selected delivery customer**

In `pages/pdv/PDVPage.tsx`, add state near delivery state:

```ts
const [deliveryPersonCustomerId, setDeliveryPersonCustomerId] = useState<string>('');
```

When the selected delivery option is a customer-backed delivery person, call:

```ts
setDeliveryPersonCustomerId(selectedDeliveryCustomer.id);
```

When clearing delivery:

```ts
setDeliveryPersonCustomerId('');
```

- [ ] **Step 4: Send the customer id on finalization**

Inside `saleInput`:

```ts
delivery_person_customer_id: deliveryPersonCustomerId || undefined,
```

- [ ] **Step 5: Run checks**

Run:

```powershell
npm.cmd run test:customer-delivery
npm.cmd run build
```

Expected: both pass.

---

### Task 3: Frontend Delivery Service

**Files:**
- Create: `services/customerDeliveryService.ts`
- Test: `tmp-tests/customer-delivery-ledger-static.test.mjs`

- [ ] **Step 1: Create service**

Create `services/customerDeliveryService.ts`:

```ts
import { vpsClient } from './vpsClient';
import { toCents } from './customerDebtService';

export interface CustomerDeliveryLedgerEntry {
  id: string;
  customer_id: string;
  sale_id?: string | null;
  amount: number | string;
  description: string;
  status: 'open' | 'settled' | 'cancelled';
  delivered_at: string;
  created_at?: string;
}

export interface CustomerDeliverySettlement {
  id: string;
  customer_id: string;
  ledger_id?: string | null;
  debt_id?: string | null;
  type: 'payment' | 'debt_offset';
  amount: number | string;
  paid_at: string;
  description: string;
  created_at?: string;
}

export interface CustomerDeliveryLedgerResponse {
  ledger: CustomerDeliveryLedgerEntry[];
  settlements: CustomerDeliverySettlement[];
  summary: {
    open_cents: number;
    earned_cents: number;
    settled_cents: number;
  };
}

export async function getCustomerDeliveryLedger(customerId: string): Promise<CustomerDeliveryLedgerResponse> {
  const data = await vpsClient.get<CustomerDeliveryLedgerResponse>(`/customers/${customerId}/delivery-ledger`);
  return {
    ledger: Array.isArray(data.ledger) ? data.ledger : [],
    settlements: Array.isArray(data.settlements) ? data.settlements : [],
    summary: {
      open_cents: toCents(data.summary?.open_cents),
      earned_cents: toCents(data.summary?.earned_cents),
      settled_cents: toCents(data.summary?.settled_cents),
    },
  };
}

export async function registerCustomerDeliveryPayment(customerId: string, input: { amount: number; description: string; paid_at?: string }) {
  return vpsClient.post(`/customers/${customerId}/delivery-payments`, input);
}

export async function offsetCustomerDeliveryBalance(customerId: string, input: { debt_id: string; amount: number; description: string }) {
  return vpsClient.post(`/customers/${customerId}/delivery-offsets`, input);
}
```

- [ ] **Step 2: Extend static test**

Add assertions:

```js
const deliveryService = readFileSync(new URL('../services/customerDeliveryService.ts', import.meta.url), 'utf8');
assert.match(deliveryService, /getCustomerDeliveryLedger/, 'frontend must load delivery ledger');
assert.match(deliveryService, /registerCustomerDeliveryPayment/, 'frontend must register delivery payments');
assert.match(deliveryService, /offsetCustomerDeliveryBalance/, 'frontend must offset balance against debts');
```

- [ ] **Step 3: Run test**

Run:

```powershell
npm.cmd run test:customer-delivery
```

Expected: pass.

---

### Task 4: Customer Profile Delivery Tab

**Files:**
- Create: `components/customer/profile/DeliveryWorkerTab.tsx`
- Modify: `pages/customer/CustomerProfilePage.tsx`
- Test: `tmp-tests/customer-delivery-ledger-static.test.mjs`

- [ ] **Step 1: Create tab component**

Create `components/customer/profile/DeliveryWorkerTab.tsx` with these UI sections:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Bike, CreditCard, Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '../../../types/customer';
import { formatCurrencyCents, listCustomerDebts, toCents, type CustomerDebt } from '../../../services/customerDebtService';
import {
  getCustomerDeliveryLedger,
  offsetCustomerDeliveryBalance,
  registerCustomerDeliveryPayment,
  type CustomerDeliveryLedgerEntry,
  type CustomerDeliverySettlement,
} from '../../../services/customerDeliveryService';

interface DeliveryWorkerTabProps {
  customer: Customer;
}

function todayDateTimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export const DeliveryWorkerTab: React.FC<DeliveryWorkerTabProps> = ({ customer }) => {
  const [ledger, setLedger] = useState<CustomerDeliveryLedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<CustomerDeliverySettlement[]>([]);
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('Pagamento de entregas');
  const [paidAt, setPaidAt] = useState(todayDateTimeLocal());
  const [offsetDebtId, setOffsetDebtId] = useState('');
  const [offsetAmount, setOffsetAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [deliveryData, customerDebts] = await Promise.all([
      getCustomerDeliveryLedger(customer.id),
      listCustomerDebts(customer.id),
    ]);
    setLedger(deliveryData.ledger);
    setSettlements(deliveryData.settlements);
    setDebts(customerDebts.filter((debt) => toCents(debt.saldo_devedor) > 0));
    setLoading(false);
  };

  useEffect(() => { void reload(); }, [customer.id]);

  const earned = useMemo(() => ledger.reduce((sum, item) => sum + toCents(item.amount), 0), [ledger]);
  const settled = useMemo(() => settlements.reduce((sum, item) => sum + toCents(item.amount), 0), [settlements]);
  const payable = Math.max(0, earned - settled);

  const submitPayment = async () => {
    const amount = Math.round(Number(paymentAmount.replace(',', '.')) * 100);
    if (amount <= 0 || amount > payable) return toast.error('Valor de pagamento invalido');
    if (!paymentDescription.trim()) return toast.error('Informe a descricao do pagamento');
    setSaving(true);
    try {
      await registerCustomerDeliveryPayment(customer.id, { amount, description: paymentDescription.trim(), paid_at: paidAt });
      toast.success('Pagamento do entregador registrado');
      setPaymentAmount('');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const submitOffset = async () => {
    const amount = Math.round(Number(offsetAmount.replace(',', '.')) * 100);
    if (!offsetDebtId) return toast.error('Escolha um debito para abater');
    if (amount <= 0 || amount > payable) return toast.error('Valor de abatimento invalido');
    setSaving(true);
    try {
      await offsetCustomerDeliveryBalance(customer.id, { debt_id: offsetDebtId, amount, description: 'Abatimento com saldo de entregas' });
      toast.success('Saldo de entregas abatido do debito');
      setOffsetAmount('');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-[220px] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando entregas...</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase text-blue-700">Entregador</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-800">Historico de entregas</h2>
        <p className="mt-1 text-sm text-slate-500">Entregas feitas, saldo a pagar e abatimentos no crediario.</p>
      </div>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Bike className="mb-3 h-5 w-5 text-blue-600" /><p className="text-xs font-semibold uppercase text-slate-500">Gerado em entregas</p><p className="mt-1 text-xl font-bold">{formatCurrencyCents(earned)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><CreditCard className="mb-3 h-5 w-5 text-emerald-600" /><p className="text-xs font-semibold uppercase text-slate-500">Pago/abatido</p><p className="mt-1 text-xl font-bold">{formatCurrencyCents(settled)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><ReceiptText className="mb-3 h-5 w-5 text-amber-600" /><p className="text-xs font-semibold uppercase text-slate-500">Saldo a pagar</p><p className="mt-1 text-xl font-bold">{formatCurrencyCents(payable)}</p></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Registrar pagamento</h3>
          <input className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Valor em reais" />
          <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          <textarea className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} />
          <button className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || payable <= 0} onClick={submitPayment}>Registrar pagamento</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Abater em debito do cliente</h3>
          <select className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2" value={offsetDebtId} onChange={(e) => setOffsetDebtId(e.target.value)}>
            <option value="">Escolha um debito</option>
            {debts.map((debt) => <option key={debt.id} value={debt.id}>{debt.descricao} - {formatCurrencyCents(debt.saldo_devedor)}</option>)}
          </select>
          <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={offsetAmount} onChange={(e) => setOffsetAmount(e.target.value)} placeholder="Valor em reais" />
          <button className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || payable <= 0} onClick={submitOffset}>Abater saldo</button>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-800">Entregas registradas</h3></div>
        {ledger.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">Nenhuma entrega registrada.</p> : ledger.map((item) => (
          <div key={item.id} className="flex justify-between border-b border-slate-100 px-5 py-3 last:border-b-0">
            <span className="text-sm text-slate-700">{item.description}</span>
            <span className="font-semibold text-slate-900">{formatCurrencyCents(item.amount)}</span>
          </div>
        ))}
      </section>
    </div>
  );
};
```

- [ ] **Step 2: Add profile tab**

In `CustomerProfilePage.tsx`, import:

```ts
import { DeliveryWorkerTab } from '../../components/customer/profile/DeliveryWorkerTab';
```

Extend `TabType`:

```ts
type TabType = 'overview' | 'personal' | 'history' | 'finance' | 'deliveries' | 'upgrade' | 'coins' | 'benefits';
```

Accept query:

```ts
if (tabFromQuery === 'deliveries') return 'deliveries';
```

Add tab item for admin preview only:

```ts
...(isAdminPreview ? [{ id: 'deliveries' as TabType, label: 'Entregas', icon: Truck }] : []),
```

Render:

```tsx
{activeTab === 'deliveries' && <DeliveryWorkerTab customer={effectiveCustomer} />}
```

- [ ] **Step 3: Extend static test**

Add assertions:

```js
assert.match(profile, /tabFromQuery === 'deliveries'/, 'Customer profile must support ?tab=deliveries');
assert.match(profile, /label: 'Entregas'/, 'Customer profile must show Entregas tab');
assert.match(profile, /activeTab === 'deliveries' && <DeliveryWorkerTab customer={effectiveCustomer}/, 'Customer profile must render delivery tab');
```

- [ ] **Step 4: Run checks**

Run:

```powershell
npm.cmd run test:customer-delivery
npm.cmd run build
```

Expected: both pass.

---

### Task 5: Sale Creation Integration

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/customer-delivery-ledger-static.test.mjs`

- [ ] **Step 1: Find the sale insert transaction**

Search:

```powershell
rg "INSERT INTO sales|createSale|delivery_total|delivery_person_id" vps_server.js
```

- [ ] **Step 2: Persist `delivery_person_customer_id`**

If the `sales` table does not have the field, add migration:

```js
await addColumnIfMissing('sales', 'delivery_person_customer_id', 'VARCHAR(255) NULL');
await addIndexIfMissing('sales', 'idx_sales_delivery_person_customer', 'delivery_person_customer_id');
```

Add the field to the insert/update list and the response payload.

- [ ] **Step 3: Call ledger helper after sale insert**

Inside the same transaction, after sale id is known:

```js
await createCustomerDeliveryLedgerEntryForSale(connection, {
  id,
  delivery_person_customer_id: body.delivery_person_customer_id,
  delivery_total: body.delivery_total,
  delivery_cost_store: body.delivery_cost_store,
});
```

- [ ] **Step 4: Guard against false entries**

Rules:

```js
const shouldCreateDeliveryLedger =
  String(body.delivery_type || '') === 'delivery' &&
  String(body.delivery_person_customer_id || '').trim() &&
  normalizeDeliveryLedgerAmount(body.delivery_total || body.delivery_cost_store) > 0;
```

Only call helper when `shouldCreateDeliveryLedger` is true.

- [ ] **Step 5: Run checks**

Run:

```powershell
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run test:customer-delivery
npm.cmd run build
```

Expected: all pass.

---

### Task 6: Manual QA And Publish

**Files:**
- No new source files.

- [ ] **Step 1: Test local flow**

Start dev server:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

Manual scenario:

1. Open PDV.
2. Select normal buyer customer.
3. Select delivery type.
4. Select the delivery person customer.
5. Set delivery value.
6. Finalize sale.
7. Open `/admin/customers/<delivery-customer-id>/preview?tab=deliveries`.
8. Confirm the delivery appears in history and increases `Saldo a pagar`.
9. Register a payment with date, hour, and description.
10. Confirm settlement appears and reduces `Saldo a pagar`.
11. Create/open a customer debt for the same customer.
12. Use `Abater saldo`.
13. Confirm customer debt receives payment method `saldo_entregas` and delivery balance decreases.

- [ ] **Step 2: Publish safely**

If the main worktree is dirty, publish from a clean surgical worktree:

```powershell
git worktree add --detach C:\tmp\mdv-delivery-ledger-publish HEAD
```

Copy only files modified by this plan into the worktree, run:

```powershell
npm.cmd run test:customer-delivery
npm.cmd run build
npm.cmd run deploy:vps-site
node deploy-vps-server-only.cjs
```

Expected:

- Frontend release active under `/var/www/mdv-site/releases/<timestamp>`.
- VPS server syntax checks pass before restart.
- No unrelated dirty files are published.

---

## Self-Review

- Spec coverage: customer can also be delivery person; PDV delivery selection records history; delivery values become payable balance; admin can pay; admin can offset against customer debts; every payment/offset stores date/time and description.
- Regression protection: `test:customer-delivery` checks migrations, endpoints, PDV payload, profile tab, and service methods.
- Boundary decision: this plan does not replace existing `team_members`; it adds customer-backed delivery identities and can later migrate old delivery members by linking them to customers.
