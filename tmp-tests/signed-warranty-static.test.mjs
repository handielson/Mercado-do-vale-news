import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const migration = read('migrations/007_signed_warranty_documents.sql');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
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
  assert.match(
    ddl,
    /dedupe_company_key VARCHAR\(255\) GENERATED ALWAYS AS \(COALESCE\(company_id, '__unassigned__'\)\) STORED/
  );
  assert.match(ddl, /UNIQUE KEY uniq_signed_warranty_active_sale \(active_sale_key\)/);
  assert.match(ddl, /UNIQUE KEY uniq_signed_warranty_sale_version \(sale_id, version_number\)/);
  assert.match(
    ddl,
    /UNIQUE KEY uniq_signed_warranty_company_hash \(dedupe_company_key, image_sha256\)/
  );
  assert.doesNotMatch(
    ddl,
    /UNIQUE KEY uniq_signed_warranty_company_hash \(company_id, image_sha256\)/
  );
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
  assert.match(server, /SELECT id FROM sales WHERE id = \? FOR UPDATE/);
  assert.match(server, /SELECT MAX\(version_number\)[\s\S]*FOR UPDATE/);
  assert.match(server, /dedupe_company_key = COALESCE\(\?, '__unassigned__'\)/);
  assert.match(server, /status = 'replaced', is_active = 0/);
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

console.log('signed warranty static checks passed');
