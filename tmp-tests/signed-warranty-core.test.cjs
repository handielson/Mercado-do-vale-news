const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
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
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-abcdefghX.jpg'), null);
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-abcdefghij.png'), null);
  assert.equal(parseSignedWarrantyFileName('termo-garantia-venda-ab12-cd34.jpeg'), null);
  assert.equal(parseSignedWarrantyFileName('foto.jpg'), null);
});

test('builds canonical original and PDF names', () => {
  assert.deepEqual(buildSignedWarrantyNames('ab12cd34'), {
    imageName: 'termo-garantia-venda-AB12CD34-original.jpg',
    pdfName: 'termo-garantia-venda-AB12CD34.pdf',
  });
  assert.throws(() => buildSignedWarrantyNames('AB12CD34X'), /invalid_sale_code/);
  assert.throws(() => buildSignedWarrantyNames('AB12CD34-WRONG-SALE'), /invalid_sale_code/);
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

function loadSignedWarrantyPipelineFactory() {
  const source = readFileSync('vps_server.cjs', 'utf8');
  const match = source.match(
    /\/\/ SIGNED_WARRANTY_PIPELINE_START\n([\s\S]*?)\/\/ SIGNED_WARRANTY_PIPELINE_END/
  );
  assert.ok(match, 'signed warranty pipeline block must exist');
  return Function(`${match[1]}\nreturn createSignedWarrantyPipeline;`)();
}

function createConnection(queryHandler, events) {
  return {
    async beginTransaction() {
      events.push('begin');
    },
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      events.push({ sql: normalized, params });
      return queryHandler(normalized, params);
    },
    async commit() {
      events.push('commit');
    },
    async rollback() {
      events.push('rollback');
    },
    release() {
      events.push('release');
    },
  };
}

function buildPipeline(overrides = {}) {
  const createSignedWarrantyPipeline = loadSignedWarrantyPipelineFactory();
  return createSignedWarrantyPipeline({
    pool: overrides.pool || { getConnection: async () => { throw new Error('unexpected_connection'); } },
    sharp,
    PDFDocument,
    crypto,
    normalizeSaleCode,
    buildSignedWarrantyNames,
    fitImageInsideA4,
    buildDiscardMessage,
    signedWarrantyFolder: '/home/termos-garantia',
    maxImageBytes: 15 * 1024 * 1024,
    uploadBufferToSynologyPrivateFolder:
      overrides.uploadBufferToSynologyPrivateFolder ||
      (async () => { throw new Error('unexpected_upload'); }),
  });
}

test('converts signed warranty images deterministically into JPEG and one-page A4 PDF', async () => {
  const sourceBuffer = await sharp({
    create: {
      width: 1200,
      height: 600,
      channels: 4,
      background: { r: 20, g: 80, b: 140, alpha: 0.6 },
    },
  }).png().toBuffer();
  const pipeline = buildPipeline();

  const first = await pipeline.convertSignedWarrantyImage(sourceBuffer);
  const second = await pipeline.convertSignedWarrantyImage(sourceBuffer);

  assert.equal(first.imageBuffer[0], 0xff);
  assert.equal(first.imageBuffer[1], 0xd8);
  assert.deepEqual(first.imageBuffer, second.imageBuffer);
  assert.deepEqual(first.pdfBuffer, second.pdfBuffer);
  assert.equal(first.imageSha256, crypto.createHash('sha256').update(first.imageBuffer).digest('hex'));
  assert.equal(first.pdfSha256, crypto.createHash('sha256').update(first.pdfBuffer).digest('hex'));

  const pdf = await PDFDocument.load(first.pdfBuffer);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.01);
  assert.ok(Math.abs(height - 841.89) < 0.01);
});

test('serializes a sale before uploads and replaces the active version transactionally', async () => {
  const events = [];
  const insertedRow = {
    id: 'document-2',
    sale_id: 'ab12cd34-sale',
    version_number: 2,
    status: 'available',
    is_active: 1,
  };
  const connection = createConnection((sql) => {
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/dedupe_company_key/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 1 }]];
    if (/^UPDATE signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) return [[insertedRow]];
    throw new Error(`unexpected_query:${sql}`);
  }, events);
  const uploads = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connection },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName, buffer, options) => {
      uploads.push({ folderPath, fileName, buffer, options });
      events.push(`upload:${fileName}`);
      return `${folderPath}/${fileName}`;
    },
  });
  const sourceBuffer = await sharp({
    create: { width: 80, height: 120, channels: 3, background: '#ffffff' },
  }).png().toBuffer();

  const row = await pipeline.processSignedWarrantyImage({
    sourceBuffer,
    originalFileName: 'capture.png',
    sale: {
      id: 'ab12cd34-sale',
      company_id: 'company-1',
      customer_id: 'customer-1',
    },
    source: 'sale_screen',
    uploadedByCustomerId: 'admin-1',
  });

  assert.deepEqual(row, insertedRow);
  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].folderPath, '/home/termos-garantia/AB12CD34/v2');
  assert.equal(uploads[0].fileName, 'termo-garantia-venda-AB12CD34-original.jpg');
  assert.equal(uploads[1].fileName, 'termo-garantia-venda-AB12CD34.pdf');
  assert.equal(uploads.every((upload) => upload.options.overwrite === true), true);

  const saleLockIndex = events.findIndex((event) => event.sql && /SELECT id FROM sales/.test(event.sql));
  const firstUploadIndex = events.findIndex((event) => typeof event === 'string' && event.startsWith('upload:'));
  const replaceIndex = events.findIndex((event) => event.sql && /^UPDATE signed_warranty_documents/.test(event.sql));
  const insertIndex = events.findIndex((event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql));
  const commitIndex = events.indexOf('commit');
  assert.ok(saleLockIndex > events.indexOf('begin'));
  assert.ok(firstUploadIndex > saleLockIndex);
  assert.ok(replaceIndex > firstUploadIndex);
  assert.ok(insertIndex > replaceIndex);
  assert.ok(commitIndex > insertIndex);

  const insert = events[insertIndex];
  assert.match(insert.sql, /status,[\s\S]*version_number, is_active/);
  assert.match(insert.sql, /'available'/);
  assert.match(insert.sql, /processed_at, discarded_at/);
  assert.equal(insert.params.includes(2), true);
});

test('returns the company hash duplicate without uploading or replacing a version', async () => {
  const events = [];
  const duplicate = {
    id: 'existing-document',
    image_sha256: 'existing-hash',
    status: 'available',
  };
  const connection = createConnection((sql) => {
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/dedupe_company_key/.test(sql)) return [[duplicate]];
    throw new Error(`unexpected_query:${sql}`);
  }, events);
  let uploads = 0;
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connection },
    uploadBufferToSynologyPrivateFolder: async () => {
      uploads += 1;
    },
  });
  const sourceBuffer = await sharp({
    create: { width: 30, height: 30, channels: 3, background: '#ffffff' },
  }).png().toBuffer();

  const row = await pipeline.processSignedWarrantyImage({
    sourceBuffer,
    originalFileName: 'capture.png',
    sale: { id: 'ab12cd34-sale', company_id: 'company-1', customer_id: 'customer-1' },
    source: 'sale_screen',
  });

  assert.deepEqual(row, duplicate);
  assert.equal(uploads, 0);
  assert.equal(events.some((event) => event.sql && /^UPDATE signed_warranty_documents/.test(event.sql)), false);
  assert.equal(events.some((event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql)), false);
  assert.ok(events.indexOf('commit') > 0);
});

test('records a non-active error version after upload failure and rethrows the processing error', async () => {
  const primaryEvents = [];
  const errorEvents = [];
  const primaryConnection = createConnection((sql) => {
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/dedupe_company_key/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 3 }]];
    throw new Error(`unexpected_query:${sql}`);
  }, primaryEvents);
  const errorConnection = createConnection((sql) => {
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/SELECT id FROM signed_warranty_documents[\s\S]*status = 'error'/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 3 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    throw new Error(`unexpected_query:${sql}`);
  }, errorEvents);
  const connections = [primaryConnection, errorConnection];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connections.shift() },
    uploadBufferToSynologyPrivateFolder: async () => {
      throw new Error('synology_unavailable');
    },
  });
  const sourceBuffer = await sharp({
    create: { width: 30, height: 30, channels: 3, background: '#ffffff' },
  }).png().toBuffer();

  await assert.rejects(
    pipeline.processSignedWarrantyImage({
      sourceBuffer,
      originalFileName: 'capture.png',
      sale: { id: 'ab12cd34-sale', company_id: 'company-1', customer_id: 'customer-1' },
      source: 'sale_screen',
    }),
    /synology_unavailable/
  );

  assert.ok(primaryEvents.includes('rollback'));
  const errorInsert = errorEvents.find(
    (event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql)
  );
  assert.ok(errorInsert);
  assert.match(errorInsert.sql, /'error'/);
  assert.match(errorInsert.sql, /is_active/);
  assert.equal(errorInsert.params.includes(0), true);
  assert.equal(errorInsert.params.includes(4), true);
  assert.ok(errorEvents.includes('commit'));
});
