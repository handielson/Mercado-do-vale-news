# Termo de Garantia Digitalizado no Synology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotografar o termo de garantia assinado de uma venda, preservar a imagem original no Synology, gerar um PDF A4 privado e permitir acesso somente ao administrador e ao cliente autenticado dono da venda.

**Architecture:** A VPS recebe ou descobre imagens na pasta privada `termos-garantia`, normaliza a foto com Sharp, gera o PDF com `pdf-lib`, grava versões e pendências no MySQL e transmite os arquivos por rotas autenticadas. O frontend administrativo captura câmera, webcam ou arquivo dentro da venda; o portal do cliente consulta o mesmo registro, mas recebe apenas o PDF da própria venda.

**Tech Stack:** React 18, TypeScript, Fastify 5, MySQL, Synology FileStation API, Sharp, pdf-lib, Node test runner/static regression tests.

---

## File structure

- Create `services/signedWarrantyDocumentCore.cjs`: regras puras de nome, código da venda, estados, mensagem e escala A4.
- Create `types/signedWarrantyDocument.ts`: contrato compartilhado pelo frontend.
- Create `services/signedWarrantyDocumentService.ts`: chamadas autenticadas, upload e download em Blob.
- Create `components/admin/sales/SignedWarrantyCaptureModal.tsx`: câmera traseira, webcam, arquivo e pré-visualização.
- Create `components/admin/sales/SignedWarrantyDocumentSection.tsx`: estado, upload, sincronização, impressão, substituição e histórico.
- Create `components/customer/profile/SignedWarrantyDocumentCard.tsx`: visualização restrita do PDF ativo.
- Create `migrations/007_signed_warranty_documents.sql`: tabela de versões/pendências e índices.
- Modify `vps_server.js`: processamento, FileStation privado, rotas, timer e migração de startup.
- Modify `vps_server.cjs`: manter o entrypoint CJS de produção funcionalmente idêntico.
- Modify `components/admin/sales/SaleDetailsModal.tsx`: montar a seção na venda específica.
- Modify `components/customer/profile/PurchaseHistoryTab.tsx`: montar o cartão na compra correspondente.
- Modify `package.json` and `package-lock.json`: dependências e comando de regressão.
- Create `tmp-tests/signed-warranty-core.test.cjs`: testes unitários das regras puras.
- Create `tmp-tests/signed-warranty-static.test.mjs`: cobertura estrutural de segurança e integração.

### Task 1: Core contract, naming and A4 geometry

**Files:**
- Create: `services/signedWarrantyDocumentCore.cjs`
- Create: `types/signedWarrantyDocument.ts`
- Create: `tmp-tests/signed-warranty-core.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing core tests**

```js
// tmp-tests/signed-warranty-core.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSaleCode,
  parseSignedWarrantyFileName,
  buildSignedWarrantyNames,
  buildDiscardMessage,
  fitImageInsideA4,
} = require('../services/signedWarrantyDocumentCore.cjs');

test('normalizes the visible eight-character sale code', () => {
  assert.equal(normalizeSaleCode(' ab12-cd34 '), 'AB12CD34');
});

test('accepts only direct Synology source image names', () => {
  assert.deepEqual(parseSignedWarrantyFileName('termo-garantia-venda-ab12cd34.png'), {
    saleCode: 'AB12CD34',
    extension: 'png',
  });
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-ab12cd34.pdf'), null);
  assert.equal(parseSignedWarrantyFileName('foto.jpg'), null);
});

test('builds canonical original and PDF names', () => {
  assert.deepEqual(buildSignedWarrantyNames('ab12cd34'), {
    imageName: 'termo-garantia-venda-AB12CD34-original.jpg',
    pdfName: 'termo-garantia-venda-AB12CD34.pdf',
  });
});

test('builds the approved screen-only disposal message', () => {
  assert.equal(
    buildDiscardMessage(new Date('2026-06-23T18:30:00-03:00'), 'pt-BR', 'America/Sao_Paulo'),
    'Documento físico digitalizado, destruído e descartado em 23/06/2026 às 18:30.'
  );
});

test('fits portrait and landscape images inside A4 without cropping', () => {
  const portrait = fitImageInsideA4(1200, 1800, 595.28, 841.89, 24);
  assert.ok(portrait.width <= 547.28 && portrait.height <= 793.89);
  const landscape = fitImageInsideA4(1800, 1200, 595.28, 841.89, 24);
  assert.ok(landscape.width <= 547.28 && landscape.height <= 793.89);
});
```

- [ ] **Step 2: Run the core test and verify it fails**

Run: `node --test tmp-tests/signed-warranty-core.test.cjs`

Expected: FAIL with `Cannot find module '../services/signedWarrantyDocumentCore.cjs'`.

- [ ] **Step 3: Implement the pure core module**

```js
// services/signedWarrantyDocumentCore.cjs
const SOURCE_PATTERN = /^termo-garantia-venda-([a-z0-9-]{8,20})\.(jpe?g|png)$/i;

function normalizeSaleCode(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}

function parseSignedWarrantyFileName(fileName) {
  const match = String(fileName || '').match(SOURCE_PATTERN);
  if (!match) return null;
  const saleCode = normalizeSaleCode(match[1]);
  if (saleCode.length !== 8) return null;
  return { saleCode, extension: match[2].toLowerCase().replace('jpeg', 'jpg') };
}

function buildSignedWarrantyNames(saleCode) {
  const code = normalizeSaleCode(saleCode);
  if (code.length !== 8) throw new Error('invalid_sale_code');
  return {
    imageName: `termo-garantia-venda-${code}-original.jpg`,
    pdfName: `termo-garantia-venda-${code}.pdf`,
  };
}

function buildDiscardMessage(date, locale = 'pt-BR', timeZone = 'America/Sao_Paulo') {
  const day = new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `Documento físico digitalizado, destruído e descartado em ${day} às ${time}.`;
}

function fitImageInsideA4(imageWidth, imageHeight, pageWidth, pageHeight, margin) {
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { width, height, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2 };
}

module.exports = {
  normalizeSaleCode,
  parseSignedWarrantyFileName,
  buildSignedWarrantyNames,
  buildDiscardMessage,
  fitImageInsideA4,
};
```

- [ ] **Step 4: Define frontend types**

```ts
// types/signedWarrantyDocument.ts
export type SignedWarrantyStatus = 'received' | 'processing' | 'available' | 'error' | 'replaced';
export type SignedWarrantySource = 'sale_screen' | 'synology_direct';

export interface SignedWarrantyDocument {
  id: string;
  sale_id?: string | null;
  customer_id?: string | null;
  sale_code?: string | null;
  status: SignedWarrantyStatus;
  source: SignedWarrantySource;
  original_file_name: string;
  image_size_bytes?: number | null;
  created_at: string;
  processed_at?: string | null;
  discarded_at?: string | null;
  discard_message?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  version_number: number;
  is_active: boolean;
}

export interface SignedWarrantySnapshot {
  active: SignedWarrantyDocument | null;
  history: SignedWarrantyDocument[];
  pending: SignedWarrantyDocument[];
}
```

- [ ] **Step 5: Add the test script and run it**

Add to `package.json`:

```json
"test:signed-warranty": "node --test tmp-tests/signed-warranty-core.test.cjs && node tmp-tests/signed-warranty-static.test.mjs"
```

Run: `node --test tmp-tests/signed-warranty-core.test.cjs`

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json services/signedWarrantyDocumentCore.cjs types/signedWarrantyDocument.ts tmp-tests/signed-warranty-core.test.cjs
git commit -m "test: define signed warranty document core"
```

### Task 2: Database schema and runtime dependencies

**Files:**
- Create: `migrations/007_signed_warranty_documents.sql`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`

- [ ] **Step 1: Extend the failing static test with schema assertions**

Create the initial `tmp-tests/signed-warranty-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const migration = read('migrations/007_signed_warranty_documents.sql');
const pkg = JSON.parse(read('package.json'));
const servers = [read('vps_server.js'), read('vps_server.cjs')];

assert.match(migration, /CREATE TABLE signed_warranty_documents/);
assert.match(migration, /image_sha256 CHAR\(64\)/);
assert.match(migration, /pdf_sha256 CHAR\(64\)/);
assert.match(migration, /version_number INT/);
assert.match(migration, /is_active TINYINT/);
assert.equal(pkg.dependencies.sharp !== undefined, true);
assert.equal(pkg.dependencies['pdf-lib'] !== undefined, true);
for (const server of servers) {
  assert.match(server, /CREATE TABLE IF NOT EXISTS signed_warranty_documents/);
}
console.log('signed warranty static checks passed');
```

- [ ] **Step 2: Run the static test and verify it fails**

Run: `node tmp-tests/signed-warranty-static.test.mjs`

Expected: FAIL because migration and dependencies do not exist.

- [ ] **Step 3: Add the migration**

```sql
CREATE TABLE signed_warranty_documents (
  id CHAR(36) PRIMARY KEY,
  company_id VARCHAR(255) NULL,
  sale_id VARCHAR(255) NULL,
  customer_id VARCHAR(255) NULL,
  sale_code VARCHAR(8) NULL,
  source ENUM('sale_screen','synology_direct') NOT NULL,
  status ENUM('received','processing','available','error','replaced') NOT NULL DEFAULT 'received',
  original_file_name VARCHAR(255) NOT NULL,
  image_path VARCHAR(600) NULL,
  pdf_path VARCHAR(600) NULL,
  image_mime_type VARCHAR(80) NULL,
  image_size_bytes BIGINT NULL,
  image_sha256 CHAR(64) NULL,
  pdf_sha256 CHAR(64) NULL,
  error_code VARCHAR(80) NULL,
  error_message TEXT NULL,
  version_number INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_by_customer_id VARCHAR(255) NULL,
  processed_at DATETIME NULL,
  discarded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_signed_warranty_sale_active (sale_id, is_active),
  INDEX idx_signed_warranty_status (status, created_at),
  INDEX idx_signed_warranty_sale_code (sale_code),
  UNIQUE KEY uniq_signed_warranty_company_hash (company_id, image_sha256)
);
```

- [ ] **Step 4: Install server-side conversion dependencies**

Run: `npm install sharp@^0.34.0 pdf-lib@^1.17.1`

Expected: `package.json` and `package-lock.json` include both packages.

- [ ] **Step 5: Add equivalent startup schema creation to both server entrypoints**

Inside `runMigrations()` in `vps_server.js` and `vps_server.cjs`, execute the same `CREATE TABLE IF NOT EXISTS signed_warranty_documents (...)` definition from the migration, using MySQL-compatible types.

Run: `node --check vps_server.js; node --check vps_server.cjs`

Expected: both commands exit 0.

- [ ] **Step 6: Run tests and commit**

Run: `node tmp-tests/signed-warranty-static.test.mjs`

Expected: PASS.

```powershell
git add migrations/007_signed_warranty_documents.sql package.json package-lock.json vps_server.js vps_server.cjs tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: add signed warranty storage schema"
```

### Task 3: Private Synology processing pipeline

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `tmp-tests/signed-warranty-core.test.cjs`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing assertions for private folder and conversion**

Append:

```js
for (const server of servers) {
  assert.match(server, /SIGNED_WARRANTY_SYNOLOGY_FOLDER/);
  assert.match(server, /processSignedWarrantyImage/);
  assert.match(server, /sharp\(sourceBuffer\)\.rotate\(\)/);
  assert.match(server, /PDFDocument\.create\(\)/);
  assert.match(server, /uploadBufferToSynologyPrivateFolder/);
  assert.match(server, /downloadBufferFromSynologyPrivateFolder/);
  assert.doesNotMatch(server, /SYNO_CDN\.termos_garantia/);
}
```

Run: `node tmp-tests/signed-warranty-static.test.mjs`

Expected: FAIL on `SIGNED_WARRANTY_SYNOLOGY_FOLDER`.

- [ ] **Step 2: Add configuration and generic private FileStation helpers**

Add to both servers:

```js
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const {
  normalizeSaleCode,
  parseSignedWarrantyFileName,
  buildSignedWarrantyNames,
  fitImageInsideA4,
} = require('./services/signedWarrantyDocumentCore.cjs');

const SIGNED_WARRANTY_SYNOLOGY_FOLDER =
  process.env.SIGNED_WARRANTY_SYNOLOGY_FOLDER || '/home/termos-garantia';
const SIGNED_WARRANTY_MAX_IMAGE_BYTES =
  Math.max(1, Number(process.env.SIGNED_WARRANTY_MAX_IMAGE_MB || 15)) * 1024 * 1024;
```

Implement `listPrivateSynologyFolder`, `downloadBufferFromSynologyPrivateFolder`, `uploadBufferToSynologyPrivateFolder` and `deletePrivateSynologyFile` using `SYNO.FileStation.List`, `Download`, `Upload` and `Delete`. Each helper must receive a folder/path argument, authenticate with `synoLogin()`, reject JSON API errors, and never construct a CDN URL.

- [ ] **Step 3: Implement deterministic image and PDF conversion**

```js
async function convertSignedWarrantyImage(sourceBuffer) {
  if (!Buffer.isBuffer(sourceBuffer) || sourceBuffer.length === 0) throw new Error('empty_image');
  if (sourceBuffer.length > SIGNED_WARRANTY_MAX_IMAGE_BYTES) throw new Error('image_too_large');

  const imageBuffer = await sharp(sourceBuffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error('invalid_image_dimensions');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const embedded = await pdf.embedJpg(imageBuffer);
  const placement = fitImageInsideA4(metadata.width, metadata.height, 595.28, 841.89, 24);
  page.drawImage(embedded, placement);
  const pdfBuffer = Buffer.from(await pdf.save());

  return {
    imageBuffer,
    pdfBuffer,
    imageSha256: crypto.createHash('sha256').update(imageBuffer).digest('hex'),
    pdfSha256: crypto.createHash('sha256').update(pdfBuffer).digest('hex'),
  };
}
```

- [ ] **Step 4: Implement transactional version processing**

Implement:

```js
async function processSignedWarrantyImage({
  sourceBuffer,
  originalFileName,
  sale,
  source,
  uploadedByCustomerId = null,
}) { /* validate -> convert -> upload both -> transactionally replace active row */ }
```

Required transaction order:

1. derive `saleCode = normalizeSaleCode(sale.id)`;
2. convert and hash;
3. return the existing row when `(company_id, image_sha256)` already exists;
4. upload canonical JPEG and PDF with overwrite enabled;
5. `SELECT MAX(version_number) ... FOR UPDATE`;
6. mark previous active row `status='replaced', is_active=0`;
7. insert the new row as `available`, `is_active=1`, with `processed_at` and `discarded_at` set only after both uploads succeed;
8. commit;
9. on failure, insert/update an `error` row without publishing it to customers.

- [ ] **Step 5: Run syntax and regression tests**

Run:

```powershell
node --check vps_server.js
node --check vps_server.cjs
node --test tmp-tests/signed-warranty-core.test.cjs
node tmp-tests/signed-warranty-static.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add vps_server.js vps_server.cjs tmp-tests/signed-warranty-core.test.cjs tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: process signed warranty files privately"
```

### Task 4: Authenticated API routes and ownership enforcement

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing route and security assertions**

```js
for (const server of servers) {
  assert.match(server, /fastify\.post\('\/admin\/sales\/:saleId\/signed-warranty'/);
  assert.match(server, /fastify\.get\('\/sales\/:saleId\/signed-warranty'/);
  assert.match(server, /fastify\.get\('\/signed-warranty\/:id\/pdf'/);
  assert.match(server, /fastify\.get\('\/admin\/signed-warranty\/:id\/original'/);
  assert.match(server, /fastify\.post\('\/admin\/signed-warranty\/sync'/);
  assert.match(server, /String\(sale\.customer_id\) !== String\(auth\.customerId\)/);
  assert.match(server, /Content-Disposition.*termo-garantia-venda/);
  assert.doesNotMatch(server, /signed-warranty[^\\n]+requireSyncKeyOrCustomer/);
}
```

Run: `node tmp-tests/signed-warranty-static.test.mjs`

Expected: FAIL because routes are absent.

- [ ] **Step 2: Add an explicit bearer authorization helper**

```js
async function requireSignedWarrantyBearerAccess(request, reply) {
  const auth = await getVpsBearerAuthContext(request);
  if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
  request.signedWarrantyAccess = auth;
}
```

Do not accept `x-sync-key` on customer/admin document routes.

- [ ] **Step 3: Add admin upload and snapshot routes**

Implement:

- `POST /admin/sales/:saleId/signed-warranty` with `requireAdminBearerToken`, multipart JPEG/PNG, 15 MB limit.
- `GET /sales/:saleId/signed-warranty` with `requireSignedWarrantyBearerAccess`; admins receive active/history/pending, customers receive only active.
- Return 404 when the sale does not exist.
- Return 403 when a non-admin session does not own `sale.customer_id`.

- [ ] **Step 4: Add private streaming routes**

Implement:

- `GET /signed-warranty/:id/pdf`: admin or owning customer; stream `application/pdf`, `Cache-Control: private, no-store`.
- `GET /admin/signed-warranty/:id/original`: admin only; stream `image/jpeg`.
- Set `Content-Disposition: inline; filename="termo-garantia-venda-{CODE}.pdf"` for PDF.
- Never return `image_path` or `pdf_path` in public/customer JSON.

- [ ] **Step 5: Add manual synchronization endpoint**

Implement `POST /admin/signed-warranty/sync` with `requireAdminBearerToken`. Return:

```js
{ scanned: 0, processed: 0, duplicates: 0, pending: 0, errors: [] }
```

The route calls the scanner from Task 5 synchronously for a bounded batch and rejects a second concurrent scan with HTTP 409.

- [ ] **Step 6: Run tests and commit**

Run: `node tmp-tests/signed-warranty-static.test.mjs`

Expected: PASS.

```powershell
git add vps_server.js vps_server.cjs tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: expose private signed warranty API"
```

### Task 5: Direct Synology discovery, pending queue and scheduler

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing scanner assertions**

```js
for (const server of servers) {
  assert.match(server, /scanSignedWarrantySynologyFolder/);
  assert.match(server, /parseSignedWarrantyFileName/);
  assert.match(server, /LEFT\(REPLACE\(id, '-', ''\), 8\)/);
  assert.match(server, /signedWarrantySyncInFlight/);
  assert.match(server, /SIGNED_WARRANTY_SYNC_INTERVAL_MS/);
  assert.match(server, /scheduleSignedWarrantySync/);
}
```

- [ ] **Step 2: Implement exact sale lookup**

```js
async function findSaleByVisibleCode(saleCode) {
  const [rows] = await pool.query(
    `SELECT id, company_id, customer_id
       FROM sales
      WHERE UPPER(LEFT(REPLACE(id, '-', ''), 8)) = ?
      LIMIT 2`,
    [normalizeSaleCode(saleCode)]
  );
  if (rows.length !== 1) return { sale: null, reason: rows.length === 0 ? 'sale_not_found' : 'ambiguous_sale' };
  return { sale: rows[0], reason: null };
}
```

- [ ] **Step 3: Implement scanner behavior**

`scanSignedWarrantySynologyFolder({ limit = 50 })` must:

- list only files in the root private folder;
- ignore canonical `-original.jpg` and generated `.pdf` files;
- parse source `.jpg`, `.jpeg`, `.png`;
- create an `error` pending row for invalid names, missing sales, ambiguous sales or corrupt images;
- download and call `processSignedWarrantyImage`;
- delete the consumed source only after the canonical JPEG, PDF and database row are confirmed; the canonical JPEG was already written by `processSignedWarrantyImage`;
- collect counts without stopping the batch after one error.

- [ ] **Step 4: Add guarded periodic synchronization**

```js
const SIGNED_WARRANTY_SYNC_INTERVAL_MS =
  Math.max(60_000, Number(process.env.SIGNED_WARRANTY_SYNC_INTERVAL_MS || 300_000));
let signedWarrantySyncInFlight = false;

function scheduleSignedWarrantySync() {
  const timer = setInterval(() => {
    if (signedWarrantySyncInFlight) return;
    signedWarrantySyncInFlight = true;
    scanSignedWarrantySynologyFolder({ limit: 50 })
      .catch(error => console.error('[signed-warranty-sync]', error))
      .finally(() => { signedWarrantySyncInFlight = false; });
  }, SIGNED_WARRANTY_SYNC_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}
```

Call `scheduleSignedWarrantySync()` only after `runMigrations()` succeeds.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
node --check vps_server.js
node --check vps_server.cjs
node tmp-tests/signed-warranty-static.test.mjs
```

Expected: PASS.

```powershell
git add vps_server.js vps_server.cjs tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: sync signed warranties from Synology"
```

### Task 6: Frontend service with private Blob downloads

**Files:**
- Create: `services/signedWarrantyDocumentService.ts`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing service assertions**

```js
const frontendService = read('services/signedWarrantyDocumentService.ts');
assert.match(frontendService, /uploadSignedWarranty/);
assert.match(frontendService, /getSignedWarrantySnapshot/);
assert.match(frontendService, /syncSignedWarrantyFolder/);
assert.match(frontendService, /downloadSignedWarrantyPdf/);
assert.match(frontendService, /Authorization: `Bearer \$\{token\}`/);
assert.doesNotMatch(frontendService, /pdf_path|image_path/);
```

- [ ] **Step 2: Implement service methods**

```ts
import { getAuthSessionToken } from './authSession';
import { buildVpsUrl } from './vpsProxyBase';
import { vpsClient } from './vpsClient';
import type { SignedWarrantySnapshot } from '../types/signedWarrantyDocument';

export async function getSignedWarrantySnapshot(saleId: string) {
  return vpsClient.get<SignedWarrantySnapshot>(`/sales/${encodeURIComponent(saleId)}/signed-warranty`);
}

export async function uploadSignedWarranty(saleId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return vpsClient.upload<SignedWarrantySnapshot>(`/admin/sales/${encodeURIComponent(saleId)}/signed-warranty`, form);
}

export async function syncSignedWarrantyFolder() {
  return vpsClient.post<{ scanned: number; processed: number; pending: number }>(
    '/admin/signed-warranty/sync',
    {}
  );
}

async function authenticatedBlob(path: string): Promise<Blob> {
  const token = await getAuthSessionToken();
  if (!token) throw new Error('Sessão expirada');
  const response = await fetch(buildVpsUrl(path, { method: 'GET' }), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Documento indisponível (${response.status})`);
  return response.blob();
}

export const downloadSignedWarrantyPdf = (id: string) =>
  authenticatedBlob(`/signed-warranty/${encodeURIComponent(id)}/pdf`);

export const downloadSignedWarrantyOriginal = (id: string) =>
  authenticatedBlob(`/admin/signed-warranty/${encodeURIComponent(id)}/original`);
```

- [ ] **Step 3: Run the static test and type-check**

Run:

```powershell
node tmp-tests/signed-warranty-static.test.mjs
npx tsc --noEmit --pretty false
```

Expected: static test PASS; TypeScript introduces no new errors in this service.

- [ ] **Step 4: Commit**

```powershell
git add services/signedWarrantyDocumentService.ts tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: add signed warranty frontend service"
```

### Task 7: Admin camera, webcam and sale-specific document section

**Files:**
- Create: `components/admin/sales/SignedWarrantyCaptureModal.tsx`
- Create: `components/admin/sales/SignedWarrantyDocumentSection.tsx`
- Modify: `components/admin/sales/SaleDetailsModal.tsx`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing UI assertions**

```js
const capture = read('components/admin/sales/SignedWarrantyCaptureModal.tsx');
const section = read('components/admin/sales/SignedWarrantyDocumentSection.tsx');
const saleModal = read('components/admin/sales/SaleDetailsModal.tsx');
assert.match(capture, /navigator\.mediaDevices\.getUserMedia/);
assert.match(capture, /capture="environment"/);
assert.match(capture, /accept="image\/jpeg,image\/png"/);
assert.match(section, /Digitalizar termo assinado/);
assert.match(section, /Sincronizar agora/);
assert.match(section, /Documento físico digitalizado, destruído e descartado/);
assert.match(section, /Substituir/);
assert.match(saleModal, /<SignedWarrantyDocumentSection/);
```

- [ ] **Step 2: Implement the capture modal**

The modal must:

- request `{ video: { facingMode: { ideal: 'environment' } }, audio: false }`;
- render `<video playsInline autoPlay>`;
- capture one frame to canvas and create `new File([blob], 'captura-termo.jpg', { type: 'image/jpeg' })`;
- expose a mobile file input with `capture="environment"`;
- expose a normal JPEG/PNG file picker;
- show an object-URL preview;
- stop every media track on close/unmount;
- call `onConfirm(file)` only after preview confirmation.

- [ ] **Step 3: Implement the admin section**

The section receives `saleId` and:

- loads `getSignedWarrantySnapshot(saleId)` when mounted;
- shows `Termo assinado pendente` when active is null;
- opens the capture modal;
- uploads and reloads the snapshot;
- shows `Abrir PDF`, `Imprimir`, `Baixar`, `Ver original` and `Substituir`;
- uses Blob object URLs and revokes them after use;
- shows the exact backend `discard_message`;
- shows version history and pending errors to admin;
- offers `Sincronizar agora` and reports processed/pending counts.

- [ ] **Step 4: Mount it inside the specific sale**

In `SaleDetailsModal.tsx`, import and render:

```tsx
{sale && (
  <SignedWarrantyDocumentSection
    saleId={sale.id}
    saleCode={sale.id.slice(0, 8).toUpperCase()}
  />
)}
```

Place it in the document/actions area before destructive sale actions, not on the customer-wide screen.

- [ ] **Step 5: Run tests and build**

Run:

```powershell
node tmp-tests/signed-warranty-static.test.mjs
npm run build
```

Expected: PASS and Vite build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add components/admin/sales/SignedWarrantyCaptureModal.tsx components/admin/sales/SignedWarrantyDocumentSection.tsx components/admin/sales/SaleDetailsModal.tsx tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: capture signed warranty from sale"
```

### Task 8: Customer-owned PDF card

**Files:**
- Create: `components/customer/profile/SignedWarrantyDocumentCard.tsx`
- Modify: `components/customer/profile/PurchaseHistoryTab.tsx`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`

- [ ] **Step 1: Add failing customer UI assertions**

```js
const customerCard = read('components/customer/profile/SignedWarrantyDocumentCard.tsx');
const purchases = read('components/customer/profile/PurchaseHistoryTab.tsx');
assert.match(customerCard, /Termo de garantia assinado/);
assert.match(customerCard, /Visualizar PDF/);
assert.match(customerCard, /Baixar/);
assert.match(customerCard, /Imprimir/);
assert.match(customerCard, /discard_message/);
assert.doesNotMatch(customerCard, /original|history|pending|image_path|pdf_path/i);
assert.match(purchases, /<SignedWarrantyDocumentCard/);
```

- [ ] **Step 2: Implement the customer card**

The component receives `saleId`, loads the snapshot, returns `null` when no active document exists, and displays:

```tsx
<section>
  <h5>Termo de garantia assinado</h5>
  <p>{snapshot.active.discard_message}</p>
  <button>Visualizar PDF</button>
  <button>Baixar</button>
  <button>Imprimir</button>
</section>
```

All actions must use `downloadSignedWarrantyPdf(active.id)` and temporary object URLs. Do not expose original image, history, pending rows or storage paths.

- [ ] **Step 3: Mount the card inside each matching sale**

In the sale card rendered by `PurchaseHistoryTab.tsx`, add:

```tsx
<SignedWarrantyDocumentCard saleId={sale.id} />
```

Place it after the item list and before the online-order timeline.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
node tmp-tests/signed-warranty-static.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/customer/profile/SignedWarrantyDocumentCard.tsx components/customer/profile/PurchaseHistoryTab.tsx tmp-tests/signed-warranty-static.test.mjs
git commit -m "feat: show signed warranty to sale owner"
```

### Task 9: End-to-end authorization and operational verification

**Files:**
- Create: `tmp-tests/signed-warranty-api-guarded-check.cjs`
- Modify: `tmp-tests/signed-warranty-static.test.mjs`
- Create: `docs/versoes/2026-06-23-termo-garantia-digitalizado.md`

- [ ] **Step 1: Create a guarded API check**

```js
// tmp-tests/signed-warranty-api-guarded-check.cjs
const assert = require('node:assert/strict');

const baseUrl = process.env.MDV_API_URL;
const adminToken = process.env.MDV_ADMIN_BEARER_TOKEN;
const customerToken = process.env.MDV_CUSTOMER_BEARER_TOKEN;
const otherCustomerToken = process.env.MDV_OTHER_CUSTOMER_BEARER_TOKEN;
const saleId = process.env.MDV_SIGNED_WARRANTY_TEST_SALE_ID;

if (![baseUrl, adminToken, customerToken, otherCustomerToken, saleId].every(Boolean)) {
  console.log('SKIP: guarded signed warranty API variables not configured');
  process.exit(0);
}

async function status(path, token) {
  return fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.status);
}

(async () => {
  assert.equal(await status(`/sales/${saleId}/signed-warranty`, customerToken), 200);
  assert.equal(await status(`/sales/${saleId}/signed-warranty`, otherCustomerToken), 403);
  assert.equal(await status(`/sales/${saleId}/signed-warranty`, ''), 401);
  assert.equal(await status(`/sales/${saleId}/signed-warranty`, adminToken), 200);
  console.log('signed warranty guarded authorization checks passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the complete local suite**

Run:

```powershell
npm run test:signed-warranty
node --check vps_server.js
node --check vps_server.cjs
npm run build
```

Expected: all commands PASS.

- [ ] **Step 3: Perform browser verification**

Using a local dev server:

1. open one completed sale as admin;
2. capture with webcam;
3. replace using a PNG file;
4. confirm active version and history;
5. open, download and print PDF;
6. sign in as the owning customer and open the same sale;
7. confirm only PDF actions and disposal message are visible;
8. sign in as another customer and verify the API returns 403;
9. put `termo-garantia-venda-{CODE}.jpg` directly in the private folder;
10. click `Sincronizar agora` and verify automatic association.

Expected: every flow matches the approved design; browser console has no new errors.

- [ ] **Step 4: Write the version note**

Document:

- private Synology folder and environment variables;
- accepted direct filename pattern;
- admin and customer behavior;
- automatic message;
- migration and dependency requirements;
- rollback: disable scheduler, keep records/files, hide UI without deleting evidence.

- [ ] **Step 5: Commit**

```powershell
git add tmp-tests/signed-warranty-api-guarded-check.cjs tmp-tests/signed-warranty-static.test.mjs docs/versoes/2026-06-23-termo-garantia-digitalizado.md
git commit -m "docs: verify signed warranty workflow"
```

### Task 10: Final verification and deployment handoff

**Files:**
- Verify only; no new code expected.

- [ ] **Step 1: Confirm worktree scope**

Run: `git status --short`

Expected: only intentional feature files remain changed; pre-existing unrelated changes are not staged.

- [ ] **Step 2: Run final verification**

```powershell
npm run test:signed-warranty
node tmp-tests/customer-delivery-ledger-static.test.mjs
node tmp-tests/system-backup-admin-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
npm run build
```

Expected: all PASS.

- [ ] **Step 3: Verify server entrypoint parity for the new feature**

Run:

```powershell
rg -n "signed-warranty|signed_warranty_documents|SIGNED_WARRANTY_" vps_server.js vps_server.cjs
```

Expected: matching feature blocks and route names in both entrypoints.

- [ ] **Step 4: Review security invariants**

Confirm from code and guarded tests:

- no public Synology URL is returned;
- sync key alone cannot download documents;
- customer ownership is checked against `sales.customer_id`;
- original image route is admin-only;
- disposal timestamp is set after both uploads;
- replaced versions remain admin-only;
- direct PDFs are ignored as inputs.

- [ ] **Step 5: Prepare deployment**

Do not deploy automatically. Hand off the migration, new dependencies, environment variables and the verified publish command to the `publish-vps` workflow when the user explicitly requests production publication.
