import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const migration = read('migrations/007_signed_warranty_documents.sql');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const frontendService = read('services/signedWarrantyDocumentService.ts');
const captureModal = read('components/admin/sales/SignedWarrantyCaptureModal.tsx');
const adminSection = read('components/admin/sales/SignedWarrantyDocumentSection.tsx');
const saleDetailsModal = read('components/admin/sales/SaleDetailsModal.tsx');
const customerCard = read('components/customer/profile/SignedWarrantyDocumentCard.tsx');
const purchaseHistoryTab = read('components/customer/profile/PurchaseHistoryTab.tsx');
const servers = {
  js: read('vps_server.js'),
  cjs: read('vps_server.cjs'),
};

assert.match(migration, /CREATE TABLE signed_warranty_documents/);
assert.match(migration, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;/);

const extractSignedWarrantyDdl = (source) => {
  const match = source.match(
    /CREATE TABLE(?: IF NOT EXISTS)? signed_warranty_documents\s*\([\s\S]*?\)\s*ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;/
  );
  assert.ok(match, 'signed warranty DDL block must exist');
  return match[0];
};

const normalizeDdl = (ddl) => ddl
  .replace(/\bCREATE TABLE IF NOT EXISTS\b/, 'CREATE TABLE')
  .trim()
  .replace(/;$/, '')
  .replace(/\s+/g, ' ')
  .trim();

const migrationDdl = extractSignedWarrantyDdl(migration);
const serverDdl = Object.fromEntries(
  Object.entries(servers).map(([name, source]) => [name, extractSignedWarrantyDdl(source)])
);

for (const ddl of [migrationDdl, ...Object.values(serverDdl)]) {
  assert.match(ddl, /source ENUM\('sale_screen','synology_direct'\) NOT NULL/);
  assert.match(
    ddl,
    /status ENUM\('received','processing','available','error','replaced'\) NOT NULL DEFAULT 'received'/
  );
  assert.match(ddl, /image_sha256 CHAR\(64\) NULL/);
  assert.match(ddl, /pdf_sha256 CHAR\(64\) NULL/);
  assert.match(ddl, /version_number INT NOT NULL DEFAULT 1/);
  assert.match(ddl, /is_active TINYINT\(1\) NOT NULL DEFAULT 0/);
  assert.match(
    ddl,
    /active_sale_key VARCHAR\(255\) GENERATED ALWAYS AS \(CASE WHEN is_active = 1 THEN sale_id ELSE NULL END\) STORED/
  );
  assert.match(ddl, /UNIQUE KEY uniq_signed_warranty_active_sale \(active_sale_key\)/);
  assert.match(ddl, /UNIQUE KEY uniq_signed_warranty_sale_version \(sale_id, version_number\)/);
  assert.match(ddl, /UNIQUE KEY uniq_signed_warranty_sale_hash \(sale_id, image_sha256\)/);
  assert.doesNotMatch(ddl, /dedupe_company_key|uniq_signed_warranty_company_hash/);
}

assert.equal(pkg.dependencies.sharp, '^0.34.0');
assert.equal(pkg.dependencies['pdf-lib'], '^1.17.1');
assert.equal(lock.packages[''].dependencies.sharp, '^0.34.0');
assert.equal(lock.packages[''].dependencies['pdf-lib'], '^1.17.1');
assert.equal(lock.packages['node_modules/sharp'].version, '0.34.0');
assert.equal(lock.packages['node_modules/pdf-lib'].version, '1.17.1');
assert.deepEqual(normalizeDdl(migrationDdl), normalizeDdl(serverDdl.js));
assert.deepEqual(normalizeDdl(migrationDdl), normalizeDdl(serverDdl.cjs));

for (const server of Object.values(servers)) {
  assert.match(server, /SIGNED_WARRANTY_SYNOLOGY_FOLDER/);
  assert.match(server, /SIGNED_WARRANTY_MAX_IMAGE_BYTES/);
  assert.match(server, /listPrivateSynologyFolder/);
  assert.match(server, /downloadBufferFromSynologyPrivateFolder/);
  assert.match(server, /uploadBufferToSynologyPrivateFolder/);
  assert.match(server, /deletePrivateSynologyFile/);
  assert.match(server, /SYNO\.FileStation\.List/);
  assert.match(server, /SYNO\.FileStation\.Download/);
  assert.match(server, /SYNO\.FileStation\.Upload/);
  assert.match(server, /SYNO\.FileStation\.Delete/);
  assert.match(server, /processSignedWarrantyImage/);
  assert.match(server, /sharp\(sourceBuffer\)\s*\.rotate\(\)/);
  assert.match(server, /\.flatten\(\{ background: '#ffffff' \}\)/);
  assert.match(server, /\.jpeg\(\{ quality: 88, mozjpeg: true \}\)/);
  assert.match(server, /PDFDocument\.create\(\)/);
  assert.match(server, /pdf\.addPage\(\[595\.28, 841\.89\]\)/);
  assert.match(
    server,
    /fitImageInsideA4\(\s*metadata\.width,\s*metadata\.height,\s*595\.28,\s*841\.89,\s*24\s*\)/
  );
  assert.match(server, /crypto\.createHash\('sha256'\)/);
  assert.match(server, /GET_LOCK\(\?, \?\)/);
  assert.match(server, /RELEASE_LOCK\(\?\)/);
  assert.match(server, /SELECT id FROM sales WHERE id = \? FOR UPDATE/);
  assert.match(server, /SELECT MAX\(version_number\)[\s\S]*FOR UPDATE/);
  assert.match(server, /WHERE sale_id = \?\s+AND image_sha256 = \?/);
  assert.match(server, /'processing'/);
  assert.match(server, /status = 'replaced', is_active = 0/);
  assert.match(server, /status = 'error'[\s\S]*error_code = \?[\s\S]*error_message = \?/);
  assert.match(server, /SHOW INDEX FROM `signed_warranty_documents`/);
  assert.match(server, /DROP INDEX `uniq_signed_warranty_company_hash`/);
  assert.match(
    server,
    /ADD UNIQUE KEY `uniq_signed_warranty_sale_hash` \(`sale_id`, `image_sha256`\)/
  );
  assert.match(server, /DROP COLUMN `dedupe_company_key`/);
  assert.match(
    server,
    /CREATE TABLE IF NOT EXISTS signed_warranty_documents[\s\S]*?await upgradeSignedWarrantyDocumentIndexes\(\);/
  );
  assert.match(server, /deletePrivateSynologyFile/);
  assert.match(server, /SIGNED_WARRANTY_MAX_JSON_BYTES/);
  assert.match(server, /SIGNED_WARRANTY_MAX_DOWNLOAD_BYTES/);
  assert.match(
    server,
    /Number\.isFinite\(configuredSignedWarrantyMaxImageMb\)[\s\S]*\? configuredSignedWarrantyMaxImageMb[\s\S]*: 15\) \* 1024 \* 1024/
  );
  assert.match(server, /synology_(?:json|download)_too_large/);
  assert.ok(
    (server.match(/statusCode < 200 \|\| statusCode >= 300/g) || []).length >= 2,
    'JSON and download responses must reject non-2xx status codes'
  );
  assert.match(server, /request\.destroy\(new Error\(timeoutCode\)\)/);
  assert.match(server, /timeoutCode: 'synology_upload_timeout'/);
  assert.match(
    server,
    /request\.setTimeout\(30000, \(\) => request\.destroy\(new Error\('synology_download_timeout'\)\)\)/
  );
  assert.match(
    server,
    /fastify\.post\('\/admin\/sales\/:saleId\/signed-warranty',\s*\{\s*preHandler:\s*signedWarrantyApi\.requireAdmin/
  );
  assert.match(
    server,
    /fastify\.get\('\/sales\/:saleId\/signed-warranty',\s*\{\s*preHandler:\s*signedWarrantyApi\.requireBearer/
  );
  assert.match(
    server,
    /fastify\.get\('\/signed-warranty\/:id\/pdf',\s*\{\s*preHandler:\s*signedWarrantyApi\.requireBearer/
  );
  assert.match(
    server,
    /fastify\.get\('\/admin\/signed-warranty\/:id\/original',\s*\{\s*preHandler:\s*signedWarrantyApi\.requireAdmin/
  );
  assert.match(server, /SIGNED_WARRANTY_SYNC_INTERVAL_MS/);
  assert.match(server, /Math\.max\(60_000, Number\(process\.env\.SIGNED_WARRANTY_SYNC_INTERVAL_MS \|\| 300_000\)\)/);
  assert.match(server, /createSignedWarrantySync/);
  assert.match(server, /parseSignedWarrantyFileName/);
  assert.match(server, /UPPER\(LEFT\(REPLACE\(id, '-', ''\), 8\)\) = \?/);
  assert.match(
    server,
    /fastify\.post\('\/admin\/signed-warranty\/sync',\s*\{\s*preHandler:\s*signedWarrantyApi\.requireAdmin/
  );
  assert.match(server, /reply\.code\(409\)\.send\(\{[\s\S]*sincronizacao de termos de garantia em andamento/);
  assert.match(server, /function scheduleSignedWarrantySync\(\)/);
  assert.match(server, /signedWarrantySync\.run\(\{ trigger: 'scheduled' \}\)/);
  assert.match(server, /if \(typeof timer\.unref === 'function'\) timer\.unref\(\)/);
  assert.match(server, /runMigrations\(\)\.then\(\(\) => \{\s*scheduleSignedWarrantySync\(\);/);
  assert.doesNotMatch(
    server,
    /(?:signed-warranty|signedWarranty)[\s\S]{0,160}requireSyncKey/
  );
  assert.doesNotMatch(server, /SYNO_CDN\.termos_garantia/);
}

const extractPipeline = (source) => {
  const match = source.match(
    /\/\/ SIGNED_WARRANTY_PIPELINE_START\n([\s\S]*?)\/\/ SIGNED_WARRANTY_PIPELINE_END/
  );
  assert.ok(match, 'signed warranty pipeline block must exist');
  return match[1].trim().replace(/\r\n/g, '\n');
};
assert.equal(extractPipeline(servers.js), extractPipeline(servers.cjs));

const extractApi = (source) => {
  const match = source.match(
    /\/\/ SIGNED_WARRANTY_API_START\n([\s\S]*?)\/\/ SIGNED_WARRANTY_API_END/
  );
  assert.ok(match, 'signed warranty API block must exist');
  return match[1].trim().replace(/\r\n/g, '\n');
};
assert.equal(extractApi(servers.js), extractApi(servers.cjs));

const extractSync = (source) => {
  const match = source.match(
    /\/\/ SIGNED_WARRANTY_SYNC_START\n([\s\S]*?)\/\/ SIGNED_WARRANTY_SYNC_END/
  );
  assert.ok(match, 'signed warranty sync block must exist');
  return match[1].trim().replace(/\r\n/g, '\n');
};
assert.equal(extractSync(servers.js), extractSync(servers.cjs));

assert.match(frontendService, /uploadSignedWarranty/);
assert.match(frontendService, /getSignedWarrantySnapshot/);
assert.match(frontendService, /syncSignedWarrantyFolder/);
assert.match(frontendService, /downloadSignedWarrantyPdf/);
assert.match(frontendService, /downloadSignedWarrantyOriginal/);
assert.match(frontendService, /Authorization: `Bearer \$\{token\}`/);
assert.doesNotMatch(frontendService, /pdf_path|image_path/);

assert.match(captureModal, /navigator\.mediaDevices\.getUserMedia/);
assert.match(captureModal, /facingMode: \{ ideal: 'environment' \}/);
assert.match(captureModal, /capture="environment"/);
assert.match(captureModal, /accept="image\/jpeg,image\/png"/);
assert.match(captureModal, /track\.stop\(\)/);
assert.match(adminSection, /Digitalizar termo assinado/);
assert.match(adminSection, /Sincronizar agora/);
assert.match(adminSection, /Documento físico digitalizado, destruído e descartado/);
assert.match(adminSection, /Substituir/);
assert.match(adminSection, /downloadSignedWarrantyOriginal/);
assert.match(adminSection, /URL\.revokeObjectURL/);
assert.match(saleDetailsModal, /SignedWarrantyDocumentSection/);
assert.match(saleDetailsModal, /sale\.id\.slice\(0, 8\)\.toUpperCase\(\)/);
assert.match(customerCard, /Termo de garantia assinado/);
assert.match(customerCard, /Visualizar PDF/);
assert.match(customerCard, /Baixar/);
assert.match(customerCard, /Imprimir/);
assert.match(customerCard, /discard_message/);
assert.doesNotMatch(customerCard, /downloadSignedWarrantyOriginal|history|pending|image_path|pdf_path/i);
assert.match(purchaseHistoryTab, /SignedWarrantyDocumentCard/);

console.log('signed warranty static checks passed');
