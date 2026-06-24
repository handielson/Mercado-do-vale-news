const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
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

function loadSignedWarrantyApiFactory() {
  const source = readFileSync('vps_server.cjs', 'utf8');
  const match = source.match(
    /\/\/ SIGNED_WARRANTY_API_START\n([\s\S]*?)\/\/ SIGNED_WARRANTY_API_END/
  );
  assert.ok(match, 'signed warranty API block must exist');
  return Function(`${match[1]}\nreturn createSignedWarrantyApi;`)();
}

function createReply() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    code(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    header(name, value) {
      this.headers[String(name).toLowerCase()] = value;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

test('signed warranty document auth rejects sync keys without a bearer identity', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const api = createSignedWarrantyApi({
    pool: {},
    getVpsBearerAuthContext: async () => ({
      userId: null,
      customerId: null,
      isAdmin: false,
    }),
  });
  const request = {
    headers: {
      'x-sync-key': 'otherwise-valid-sync-key',
    },
  };
  const reply = createReply();

  await api.requireBearer(request, reply);

  assert.equal(reply.statusCode, 401);
  assert.deepEqual(reply.payload, { error: 'Bearer token required' });
  assert.equal(request.signedWarrantyAccess, undefined);
});

test('customer signed warranty listing is owner-only, active-only, and sanitized', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const queries = [];
  const api = createSignedWarrantyApi({
    pool: {
      async query(sql, params) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        queries.push({ sql: normalized, params });
        if (/FROM sales WHERE id = \? LIMIT 1/.test(normalized)) {
          return [[{ id: 'AB12CD34-sale', customer_id: 'customer-1' }]];
        }
        if (/FROM signed_warranty_documents/.test(normalized)) {
          return [[{
            id: 'document-1',
            sale_id: 'AB12CD34-sale',
            customer_id: 'customer-1',
            status: 'available',
            is_active: 1,
            image_path: '/private/original.jpg',
            pdf_path: '/private/document.pdf',
            image_sha256: 'image-hash',
            pdf_sha256: 'pdf-hash',
          }]];
        }
        throw new Error(`unexpected_query:${normalized}`);
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    }),
  });
  const request = {
    headers: { authorization: 'Bearer customer-token' },
    params: { saleId: 'AB12CD34-sale' },
    signedWarrantyAccess: {
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    },
  };
  const reply = createReply();

  const result = await api.listForSale(request, reply);

  assert.equal(reply.statusCode, 200);
  assert.deepEqual(result, {
    sale_id: 'AB12CD34-sale',
    documents: [{
      id: 'document-1',
      sale_id: 'AB12CD34-sale',
      customer_id: 'customer-1',
      status: 'available',
      is_active: 1,
    }],
  });
  assert.match(queries[1].sql, /status = 'available'/);
  assert.match(queries[1].sql, /is_active = 1/);
});

test('customer signed warranty listing rejects a different sale owner', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  let documentQueryRan = false;
  const api = createSignedWarrantyApi({
    pool: {
      async query(sql) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        if (/FROM sales WHERE id = \? LIMIT 1/.test(normalized)) {
          return [[{ id: 'AB12CD34-sale', customer_id: 'customer-2' }]];
        }
        documentQueryRan = true;
        return [[]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    }),
  });
  const reply = createReply();

  await api.listForSale({
    headers: { authorization: 'Bearer customer-token' },
    params: { saleId: 'AB12CD34-sale' },
    signedWarrantyAccess: {
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    },
  }, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.payload, { error: 'Forbidden' });
  assert.equal(documentQueryRan, false);
});

test('admin signed warranty listing includes history and hashes but hides private paths', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const queries = [];
  const api = createSignedWarrantyApi({
    pool: {
      async query(sql, params) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        queries.push({ sql: normalized, params });
        if (/FROM sales WHERE id = \? LIMIT 1/.test(normalized)) {
          return [[{ id: 'AB12CD34-sale', customer_id: 'customer-1' }]];
        }
        return [[{
          id: 'document-error',
          sale_id: 'AB12CD34-sale',
          status: 'error',
          is_active: 0,
          image_path: '/private/original.jpg',
          pdf_path: '/private/document.pdf',
          image_sha256: 'image-hash',
          pdf_sha256: 'pdf-hash',
        }]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    }),
  });

  const result = await api.listForSale({
    headers: { authorization: 'Bearer admin-token' },
    params: { saleId: 'AB12CD34-sale' },
    signedWarrantyAccess: {
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    },
  }, createReply());

  assert.equal(queries.length, 2);
  assert.doesNotMatch(queries[1].sql, /status = 'available'/);
  assert.deepEqual(result.documents, [{
    id: 'document-error',
    sale_id: 'AB12CD34-sale',
    status: 'error',
    is_active: 0,
    image_sha256: 'image-hash',
    pdf_sha256: 'pdf-hash',
  }]);
});

test('signed warranty admin auth requires an admin bearer and rejects sync-key fallback', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const api = createSignedWarrantyApi({
    pool: {},
    getVpsBearerAuthContext: async () => ({
      userId: 'customer-user',
      customerId: 'customer-1',
      isAdmin: false,
    }),
  });
  const request = {
    headers: {
      authorization: 'Bearer customer-token',
      'x-sync-key': 'otherwise-valid-sync-key',
    },
  };
  const reply = createReply();

  await api.requireAdmin(request, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.payload, { error: 'Admin bearer token required' });
  assert.equal(request.signedWarrantyAccess, undefined);
});

test('admin uploads a JPEG warranty through the hardened pipeline with a 15 MB limit', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const sourceBuffer = Buffer.from('jpeg-source');
  const processCalls = [];
  let fileOptions;
  const api = createSignedWarrantyApi({
    pool: {
      async query(sql, params) {
        assert.match(sql.replace(/\s+/g, ' ').trim(), /FROM sales WHERE id = \? LIMIT 1/);
        assert.deepEqual(params, ['sale-1']);
        return [[{
          id: 'sale-1',
          customer_id: 'customer-1',
          company_id: 'company-1',
        }]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    }),
    maxImageBytes: 15 * 1024 * 1024,
    processSignedWarrantyImage: async (input) => {
      processCalls.push(input);
      return {
        id: 'document-1',
        sale_id: 'sale-1',
        status: 'available',
        is_active: 1,
        image_path: '/private/original.jpg',
        pdf_path: '/private/document.pdf',
        image_sha256: 'image-hash',
        pdf_sha256: 'pdf-hash',
      };
    },
  });
  const request = {
    headers: { authorization: 'Bearer admin-token' },
    params: { saleId: 'sale-1' },
    signedWarrantyAccess: {
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    },
    async file(options) {
      fileOptions = options;
      return {
        filename: 'assinatura.png',
        mimetype: 'image/png',
        file: { truncated: false },
        async toBuffer() {
          return sourceBuffer;
        },
      };
    },
  };
  const reply = createReply();

  const result = await api.uploadForSale(request, reply);

  assert.equal(reply.statusCode, 201);
  assert.deepEqual(fileOptions, { limits: { fileSize: 15 * 1024 * 1024 } });
  assert.deepEqual(processCalls, [{
    sourceBuffer,
    originalFileName: 'assinatura.png',
    sale: {
      id: 'sale-1',
      customer_id: 'customer-1',
      company_id: 'company-1',
    },
    source: 'sale_screen',
    uploadedByCustomerId: 'admin-customer',
  }]);
  assert.deepEqual(result, {
    id: 'document-1',
    sale_id: 'sale-1',
    status: 'available',
    is_active: 1,
    image_sha256: 'image-hash',
    pdf_sha256: 'pdf-hash',
  });
});

test('admin warranty upload rejects non-image multipart content before processing', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  let processed = false;
  const api = createSignedWarrantyApi({
    pool: {},
    getVpsBearerAuthContext: async () => ({
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    }),
    maxImageBytes: 15 * 1024 * 1024,
    processSignedWarrantyImage: async () => {
      processed = true;
    },
  });
  const reply = createReply();

  await api.uploadForSale({
    params: { saleId: 'sale-1' },
    signedWarrantyAccess: {
      customerId: 'admin-customer',
      isAdmin: true,
    },
    async file() {
      return {
        filename: 'manual.pdf',
        mimetype: 'application/pdf',
        file: { truncated: false },
        async toBuffer() {
          return Buffer.from('%PDF');
        },
      };
    },
  }, reply);

  assert.equal(reply.statusCode, 415);
  assert.deepEqual(reply.payload, { error: 'Only JPEG and PNG images are accepted' });
  assert.equal(processed, false);
});

test('owner downloads only the active signed warranty PDF with private no-store headers', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const pdfBuffer = Buffer.from('%PDF-private');
  const downloaded = [];
  const api = createSignedWarrantyApi({
    pool: {
      async query(sql, params) {
        assert.match(sql.replace(/\s+/g, ' ').trim(), /FROM signed_warranty_documents d JOIN sales s/);
        assert.deepEqual(params, ['document-1']);
        return [[{
          id: 'document-1',
          sale_id: 'sale-1',
          sale_code: 'AB12CD34',
          sale_customer_id: 'customer-1',
          status: 'available',
          is_active: 1,
          pdf_path: '/private/document.pdf',
        }]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    }),
    downloadBufferFromSynologyPrivateFolder: async (filePath) => {
      downloaded.push(filePath);
      return pdfBuffer;
    },
  });
  const request = {
    params: { id: 'document-1' },
    signedWarrantyAccess: {
      customerId: 'customer-1',
      isAdmin: false,
    },
  };
  const reply = createReply();

  await api.downloadPdf(request, reply);

  assert.deepEqual(downloaded, ['/private/document.pdf']);
  assert.equal(reply.headers['cache-control'], 'private, no-store, max-age=0');
  assert.equal(reply.headers.pragma, 'no-cache');
  assert.equal(reply.headers['content-type'], 'application/pdf');
  assert.equal(
    reply.headers['content-disposition'],
    'inline; filename="termo-garantia-venda-AB12CD34.pdf"'
  );
  assert.equal(reply.payload, pdfBuffer);
});

test('non-owner cannot trigger a private signed warranty PDF download', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  let downloaded = false;
  const api = createSignedWarrantyApi({
    pool: {
      async query() {
        return [[{
          id: 'document-1',
          sale_id: 'sale-1',
          sale_code: 'AB12CD34',
          sale_customer_id: 'customer-2',
          status: 'available',
          is_active: 1,
          pdf_path: '/private/document.pdf',
        }]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'user-1',
      customerId: 'customer-1',
      isAdmin: false,
    }),
    downloadBufferFromSynologyPrivateFolder: async () => {
      downloaded = true;
      return Buffer.from('should-not-download');
    },
  });
  const reply = createReply();

  await api.downloadPdf({
    params: { id: 'document-1' },
    signedWarrantyAccess: {
      customerId: 'customer-1',
      isAdmin: false,
    },
  }, reply);

  assert.equal(reply.statusCode, 403);
  assert.deepEqual(reply.payload, { error: 'Forbidden' });
  assert.equal(downloaded, false);
});

test('admin downloads the original signed warranty image privately', async () => {
  const createSignedWarrantyApi = loadSignedWarrantyApiFactory();
  const imageBuffer = Buffer.from('private-jpeg');
  const api = createSignedWarrantyApi({
    pool: {
      async query() {
        return [[{
          id: 'document-1',
          sale_code: 'AB12CD34',
          image_path: '/private/original.jpg',
        }]];
      },
    },
    getVpsBearerAuthContext: async () => ({
      userId: 'admin-user',
      customerId: 'admin-customer',
      isAdmin: true,
    }),
    downloadBufferFromSynologyPrivateFolder: async () => imageBuffer,
  });
  const reply = createReply();

  await api.downloadOriginal({
    params: { id: 'document-1' },
    signedWarrantyAccess: {
      customerId: 'admin-customer',
      isAdmin: true,
    },
  }, reply);

  assert.equal(reply.headers['cache-control'], 'private, no-store, max-age=0');
  assert.equal(reply.headers['content-type'], 'image/jpeg');
  assert.equal(
    reply.headers['content-disposition'],
    'inline; filename="termo-garantia-venda-AB12CD34-original.jpg"'
  );
  assert.equal(reply.payload, imageBuffer);
});

function createConnection(queryHandler, events) {
  let commitCount = 0;
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
      commitCount += 1;
      events.push('commit');
      if (queryHandler.commit) return queryHandler.commit(commitCount);
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
    deletePrivateSynologyFile:
      overrides.deletePrivateSynologyFile ||
      (async () => { throw new Error('unexpected_delete'); }),
  });
}

function loadPrivateSynologyPathHelpers() {
  const source = readFileSync('vps_server.cjs', 'utf8');
  const match = source.match(
    /(function normalizePrivateSynologyPath[\s\S]*?function joinPrivateSynologyPath[\s\S]*?\n})/
  );
  assert.ok(match, 'private Synology path helpers must exist');
  return Function(
    'SIGNED_WARRANTY_SYNOLOGY_FOLDER',
    `${match[1]}\nreturn { normalizePrivateSynologyPath, joinPrivateSynologyPath };`
  )('/home/termos-garantia');
}

function loadSignedWarrantyIndexUpgrade() {
  const source = readFileSync('vps_server.cjs', 'utf8');
  const match = source.match(
    /(async function upgradeSignedWarrantyDocumentIndexes[\s\S]*?\n})\n\nasync function seedAutoresponderRuleTemplates/
  );
  assert.ok(match, 'signed warranty index upgrade helper must exist');
  return Function(`${match[1]}\nreturn upgradeSignedWarrantyDocumentIndexes;`)();
}

function loadPrivateSynologyHttpHelpers(https, { maxJsonBytes = 16, maxDownloadBytes = 32 } = {}) {
  const source = readFileSync('vps_server.cjs', 'utf8');
  const match = source.match(
    /(function synologyPrivateJsonRequest[\s\S]*?async function downloadBufferFromSynologyPrivateFolder[\s\S]*?\n})\n\nasync function uploadBufferToSynologyPrivateFolder/
  );
  assert.ok(match, 'private Synology HTTP helpers must exist');
  return Function(
    'require',
    'SYNO_URL',
    'getSynologyRequestPort',
    'SIGNED_WARRANTY_MAX_JSON_BYTES',
    'SIGNED_WARRANTY_MAX_DOWNLOAD_BYTES',
    'synoLogin',
    'normalizePrivateSynologyPath',
    `${match[1]}\nreturn { synologyPrivateJsonRequest, downloadBufferFromSynologyPrivateFolder };`
  )(
    (name) => {
      if (name === 'https') return https;
      return require(name);
    },
    'https://synology.local',
    () => 443,
    maxJsonBytes,
    maxDownloadBytes,
    async () => 'sid',
    (value) => value
  );
}

function createFakeHttps(onEnd) {
  return {
    request(options, callback) {
      const request = new EventEmitter();
      request.setTimeout = (_milliseconds, handler) => {
        request.timeoutHandler = handler;
      };
      request.destroy = (error) => {
        request.destroyedWith = error || true;
        if (error) queueMicrotask(() => request.emit('error', error));
      };
      request.end = (body) => onEnd({ options, callback, request, body });
      return request;
    },
  };
}

function createFakeResponse(statusCode, headers = {}) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.headers = headers;
  response.resume = () => {
    response.resumed = true;
  };
  response.destroy = () => {
    response.destroyed = true;
  };
  return response;
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

test('reserves and commits a processing version before Synology uploads, then activates it', async () => {
  const events = [];
  const insertedRow = {
    id: 'document-2',
    sale_id: 'ab12cd34-sale',
    version_number: 2,
    status: 'available',
    is_active: 1,
  };
  const queryHandler = (sql) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 1 }]];
    if (/^UPDATE signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) return [[insertedRow]];
    throw new Error(`unexpected_query:${sql}`);
  };
  const connection = createConnection(queryHandler, events);
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

  const advisoryLockIndex = events.findIndex((event) => event.sql && /SELECT GET_LOCK/.test(event.sql));
  const reservationInsertIndex = events.findIndex(
    (event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql)
  );
  const reservationCommitIndex = events.indexOf('commit');
  const firstUploadIndex = events.findIndex((event) => typeof event === 'string' && event.startsWith('upload:'));
  const replaceIndex = events.findIndex(
    (event) => event.sql && /status = 'replaced', is_active = 0/.test(event.sql)
  );
  const activateIndex = events.findIndex(
    (event) => event.sql && /SET status = 'available'/.test(event.sql)
  );
  const releaseLockIndex = events.findIndex((event) => event.sql && /SELECT RELEASE_LOCK/.test(event.sql));
  assert.ok(advisoryLockIndex >= 0);
  assert.ok(reservationInsertIndex > advisoryLockIndex);
  assert.ok(reservationCommitIndex > reservationInsertIndex);
  assert.ok(firstUploadIndex > reservationCommitIndex);
  assert.ok(replaceIndex > firstUploadIndex);
  assert.ok(activateIndex > replaceIndex);
  assert.ok(releaseLockIndex > activateIndex);

  const reservation = events[reservationInsertIndex];
  assert.match(reservation.sql, /'processing'/);
  assert.equal(reservation.params.includes(2), true);
});

test('returns the same-sale hash duplicate without uploading or reserving a version', async () => {
  const events = [];
  const duplicate = {
    id: 'existing-document',
    image_sha256: 'existing-hash',
    status: 'available',
    is_active: 1,
  };
  const connection = createConnection((sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) {
      assert.equal(params[0], 'ab12cd34-sale');
      return [[duplicate]];
    }
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

async function runInterruptedVersionRecoveryTest(existingStatus) {
  const events = [];
  const existingRow = {
    id: `${existingStatus}-document`,
    sale_id: 'ab12cd34-sale',
    version_number: existingStatus === 'processing' ? 3 : 4,
    status: existingStatus,
    is_active: 0,
    error_code: existingStatus === 'error' ? 'pdf_upload_failed' : null,
    error_message: existingStatus === 'error' ? 'PDF upload failed' : null,
  };
  const activatedRow = {
    ...existingRow,
    status: 'available',
    is_active: 1,
    error_code: null,
    error_message: null,
  };
  let rowReads = 0;
  const connection = createConnection((sql) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[existingRow]];
    if (/SET status = 'processing'/.test(sql)) return [{ affectedRows: 1 }];
    if (/status = 'replaced', is_active = 0/.test(sql)) return [{ affectedRows: 1 }];
    if (/SET status = 'available'/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) {
      rowReads += 1;
      return [[activatedRow]];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, events);
  const uploads = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connection },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName) => {
      uploads.push({ folderPath, fileName });
      return `${folderPath}/${fileName}`;
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

  assert.deepEqual(row, activatedRow);
  assert.equal(uploads.length, 2);
  assert.equal(
    uploads.every(({ folderPath }) => folderPath.endsWith(`/v${existingRow.version_number}`)),
    true
  );
  assert.equal(
    events.some((event) => event.sql && /SELECT MAX\(version_number\)/.test(event.sql)),
    false
  );
  assert.equal(
    events.some((event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql)),
    false
  );
  const reset = events.find(
    (event) => event.sql && /^UPDATE signed_warranty_documents/.test(event.sql) &&
      /SET status = 'processing'/.test(event.sql)
  );
  assert.ok(reset);
  assert.match(reset.sql, /error_code = NULL/);
  assert.match(reset.sql, /error_message = NULL/);
  assert.equal(reset.params.at(-1), existingRow.id);
  assert.equal(rowReads, 1);
}

test('recovers an abandoned processing row with the same version and document id', async () => {
  await runInterruptedVersionRecoveryTest('processing');
});

test('retries an error row with the same version and document id', async () => {
  await runInterruptedVersionRecoveryTest('error');
});

test('allows the same image hash to create a separate document for another sale', async () => {
  const events = [];
  const insertedRow = {
    id: 'other-sale-document',
    sale_id: 'xy98zt76-sale',
    version_number: 1,
    status: 'available',
    is_active: 1,
  };
  const connection = createConnection((sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'xy98zt76-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) {
      assert.equal(params[0], 'xy98zt76-sale');
      return [[]];
    }
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 0 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/^UPDATE signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) return [[insertedRow]];
    throw new Error(`unexpected_query:${sql}`);
  }, events);
  let uploads = 0;
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connection },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName) => {
      uploads += 1;
      return `${folderPath}/${fileName}`;
    },
  });
  const sourceBuffer = await sharp({
    create: { width: 30, height: 30, channels: 3, background: '#ffffff' },
  }).png().toBuffer();

  const row = await pipeline.processSignedWarrantyImage({
    sourceBuffer,
    originalFileName: 'capture.png',
    sale: { id: 'xy98zt76-sale', company_id: 'company-1', customer_id: 'customer-2' },
    source: 'sale_screen',
  });

  assert.deepEqual(row, insertedRow);
  assert.equal(uploads, 2);
});

test('best-effort deletes the intended JPEG path when the first upload fails', async () => {
  const primaryEvents = [];
  const errorEvents = [];
  let reservedId = null;
  const primaryConnection = createConnection((sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 0 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) {
      reservedId = params[0];
      return [{ affectedRows: 1 }];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, primaryEvents);
  const errorConnection = createConnection((sql, params) => {
    if (/^UPDATE signed_warranty_documents/.test(sql) && /status = 'error'/.test(sql)) {
      assert.equal(params.at(-1), reservedId);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, errorEvents);
  const connections = [primaryConnection, errorConnection];
  const deletedPaths = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connections.shift() },
    uploadBufferToSynologyPrivateFolder: async () => {
      throw new Error('jpeg_upload_failed');
    },
    deletePrivateSynologyFile: async (path) => deletedPaths.push(path),
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
    /jpeg_upload_failed/
  );

  assert.deepEqual(deletedPaths, [
    '/home/termos-garantia/AB12CD34/v1/termo-garantia-venda-AB12CD34-original.jpg',
  ]);
  assert.equal(
    errorEvents.some((event) => event.sql && /status = 'error'/.test(event.sql)),
    true
  );
});

test('cleans up the JPEG and marks the reserved row error when PDF upload fails', async () => {
  const primaryEvents = [];
  const errorEvents = [];
  let reservedId = null;
  const primaryConnection = createConnection((sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 3 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) {
      reservedId = params[0];
      return [{ affectedRows: 1 }];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, primaryEvents);
  const errorConnection = createConnection((sql, params) => {
    if (/^UPDATE signed_warranty_documents/.test(sql) && /status = 'error'/.test(sql)) {
      assert.equal(params.at(-1), reservedId);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, errorEvents);
  const connections = [primaryConnection, errorConnection];
  const uploadedPaths = [];
  const deletedPaths = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connections.shift() },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName) => {
      if (fileName.endsWith('.pdf')) throw new Error('pdf_upload_failed');
      const path = `${folderPath}/${fileName}`;
      uploadedPaths.push(path);
      return path;
    },
    deletePrivateSynologyFile: async (path) => deletedPaths.push(path),
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
    /pdf_upload_failed/
  );

  assert.deepEqual(deletedPaths, [
    uploadedPaths[0],
    '/home/termos-garantia/AB12CD34/v4/termo-garantia-venda-AB12CD34.pdf',
  ]);
  assert.equal(
    errorEvents.some(
      (event) => event.sql && /^UPDATE signed_warranty_documents/.test(event.sql) &&
        /status = 'error'/.test(event.sql)
    ),
    true
  );
  const errorUpdate = errorEvents.find(
    (event) => event.sql && /^UPDATE signed_warranty_documents/.test(event.sql) &&
      /status = 'error'/.test(event.sql)
  );
  assert.doesNotMatch(errorUpdate.sql, /image_sha256 = NULL|pdf_sha256 = NULL/);
  assert.equal(
    errorEvents.some((event) => event.sql && /^INSERT INTO signed_warranty_documents/.test(event.sql)),
    false
  );
  assert.ok(errorEvents.includes('commit'));
  assert.equal(
    primaryEvents.some((event) => event.sql && /SELECT RELEASE_LOCK/.test(event.sql)),
    true
  );
});

test('cleans up both uploads and marks the reserved row error on a precommit activation failure', async () => {
  const primaryEvents = [];
  const errorEvents = [];
  let reservedId = null;
  const primaryConnection = createConnection((sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 0 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) {
      reservedId = params[0];
      return [{ affectedRows: 1 }];
    }
    if (/SET status = 'available'/.test(sql)) {
      throw new Error('activation_update_failed');
    }
    if (/^UPDATE signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    throw new Error(`unexpected_query:${sql}`);
  }, primaryEvents);
  const errorConnection = createConnection((sql, params) => {
    if (/^UPDATE signed_warranty_documents/.test(sql) && /status = 'error'/.test(sql)) {
      assert.equal(params.at(-1), reservedId);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`unexpected_query:${sql}`);
  }, errorEvents);
  const connections = [primaryConnection, errorConnection];
  const uploadedPaths = [];
  const deletedPaths = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connections.shift() },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName) => {
      const path = `${folderPath}/${fileName}`;
      uploadedPaths.push(path);
      return path;
    },
    deletePrivateSynologyFile: async (path) => deletedPaths.push(path),
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
    /activation_update_failed/
  );

  assert.deepEqual(deletedPaths, uploadedPaths);
  assert.equal(
    errorEvents.some((event) => event.sql && /status = 'error'/.test(event.sql)),
    true
  );
  assert.equal(
    primaryEvents.some((event) => event.sql && /SELECT RELEASE_LOCK/.test(event.sql)),
    true
  );
});

test('returns success and keeps uploads when activation commits but COMMIT throws', async () => {
  const primaryEvents = [];
  const reconciliationEvents = [];
  let reservedId = null;
  let committedRow = null;
  const queryHandler = (sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 0 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) {
      reservedId = params[0];
      committedRow = {
        id: reservedId,
        sale_id: 'ab12cd34-sale',
        version_number: 1,
        status: 'processing',
        is_active: 0,
        image_sha256: params[8],
        pdf_sha256: params[9],
        image_path: null,
        pdf_path: null,
      };
      return [{ affectedRows: 1 }];
    }
    if (/status = 'replaced', is_active = 0/.test(sql)) return [{ affectedRows: 1 }];
    if (/SET status = 'available'/.test(sql)) {
      committedRow = {
        ...committedRow,
        status: 'available',
        is_active: 1,
        image_path: params[0],
        pdf_path: params[1],
      };
      return [{ affectedRows: 1 }];
    }
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) {
      return [[committedRow]];
    }
    throw new Error(`unexpected_query:${sql}`);
  };
  queryHandler.commit = (commitCount) => {
    if (commitCount === 2) throw new Error('activation_commit_outcome_unknown');
  };
  const primaryConnection = createConnection(queryHandler, primaryEvents);
  const reconciliationConnection = createConnection((sql, params) => {
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) {
      assert.equal(params[0], reservedId);
      return [[committedRow]];
    }
    throw new Error(`unexpected_reconciliation_query:${sql}`);
  }, reconciliationEvents);
  const connections = [primaryConnection, reconciliationConnection];
  const uploadedPaths = [];
  const deletedPaths = [];
  const pipeline = buildPipeline({
    pool: { getConnection: async () => connections.shift() },
    uploadBufferToSynologyPrivateFolder: async (folderPath, fileName) => {
      const path = `${folderPath}/${fileName}`;
      uploadedPaths.push(path);
      return path;
    },
    deletePrivateSynologyFile: async (path) => deletedPaths.push(path),
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

  assert.deepEqual(row, committedRow);
  assert.deepEqual(deletedPaths, []);
  assert.equal(uploadedPaths.length, 2);
  assert.equal(connections.length, 0);
  assert.equal(
    reconciliationEvents.some(
      (event) => event.sql && /SELECT \* FROM signed_warranty_documents WHERE id/.test(event.sql)
    ),
    true
  );
  assert.equal(
    reconciliationEvents.some(
      (event) => event.sql && /UPDATE signed_warranty_documents/.test(event.sql)
    ),
    false
  );
});

test('upgrades the older company-hash warranty index before dropping its unused generated column', async () => {
  const upgradeSignedWarrantyDocumentIndexes = loadSignedWarrantyIndexUpgrade();
  const events = [];
  const database = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      events.push({ sql: normalized, params });
      if (/^SHOW INDEX FROM `signed_warranty_documents`/.test(normalized)) {
        return [[
          {
            Key_name: 'uniq_signed_warranty_company_hash',
            Column_name: 'dedupe_company_key',
          },
          {
            Key_name: 'uniq_signed_warranty_company_hash',
            Column_name: 'image_sha256',
          },
          {
            Key_name: 'uniq_signed_warranty_active_sale',
            Column_name: 'active_sale_key',
          },
        ]];
      }
      if (/INFORMATION_SCHEMA\.COLUMNS/.test(normalized)) return [[{ cnt: 1 }]];
      if (/^ALTER TABLE `signed_warranty_documents`/.test(normalized)) {
        return [{ affectedRows: 0 }];
      }
      throw new Error(`unexpected_query:${normalized}`);
    },
  };

  await upgradeSignedWarrantyDocumentIndexes(database);

  const statements = events.map(({ sql }) => sql);
  const dropOldIndex = statements.findIndex(
    (sql) => /DROP INDEX `uniq_signed_warranty_company_hash`/.test(sql)
  );
  const addSaleHash = statements.findIndex(
    (sql) => /ADD UNIQUE KEY `uniq_signed_warranty_sale_hash` \(`sale_id`, `image_sha256`\)/.test(sql)
  );
  const inspectColumn = statements.findIndex(
    (sql) => /INFORMATION_SCHEMA\.COLUMNS/.test(sql) &&
      events[statements.indexOf(sql)].params.includes('dedupe_company_key')
  );
  const dropColumn = statements.findIndex(
    (sql) => /DROP COLUMN `dedupe_company_key`/.test(sql)
  );
  assert.ok(dropOldIndex >= 0);
  assert.ok(addSaleHash > dropOldIndex);
  assert.ok(inspectColumn > addSaleHash);
  assert.ok(dropColumn > inspectColumn);
});

test('confines private Synology helpers to the configured root and rejects traversal', () => {
  const { normalizePrivateSynologyPath, joinPrivateSynologyPath } =
    loadPrivateSynologyPathHelpers();

  assert.equal(
    normalizePrivateSynologyPath('/home/termos-garantia/AB12CD34/v1', 'folder'),
    '/home/termos-garantia/AB12CD34/v1'
  );
  assert.equal(
    joinPrivateSynologyPath('/home/termos-garantia/AB12CD34/v1', 'document.pdf'),
    '/home/termos-garantia/AB12CD34/v1/document.pdf'
  );
  assert.throws(
    () => normalizePrivateSynologyPath('/home/termos-garantia/../secret', 'folder'),
    /invalid_synology_folder/
  );
  assert.throws(
    () => normalizePrivateSynologyPath('/home/termos-garantia/./v1', 'folder'),
    /invalid_synology_folder/
  );
  assert.throws(
    () => normalizePrivateSynologyPath('/home/termos-garantia\\escape', 'folder'),
    /invalid_synology_folder/
  );
  assert.throws(
    () => normalizePrivateSynologyPath('/home/termos-garantia/\u0001bad', 'folder'),
    /invalid_synology_folder/
  );
  assert.throws(
    () => normalizePrivateSynologyPath('/home/other-folder/file.pdf', 'file_path'),
    /invalid_synology_file_path/
  );
  assert.throws(
    () => joinPrivateSynologyPath('/home/termos-garantia/AB12CD34/v1', 'bad\u0001name.pdf'),
    /invalid_synology_file_name/
  );
});

test('bounds private Synology HTTP responses and aborts timed out requests', async () => {
  {
    const https = createFakeHttps(({ callback }) => {
      callback(createFakeResponse(503, { 'content-type': 'application/json' }));
    });
    const { synologyPrivateJsonRequest } = loadPrivateSynologyHttpHelpers(https);
    await assert.rejects(
      synologyPrivateJsonRequest('/webapi/entry.cgi'),
      /synology_json_http_503/
    );
  }

  {
    const https = createFakeHttps(({ callback }) => {
      const response = createFakeResponse(200, { 'content-type': 'application/json' });
      callback(response);
      response.emit('data', Buffer.alloc(17, 0x61));
    });
    const { synologyPrivateJsonRequest } = loadPrivateSynologyHttpHelpers(https);
    await assert.rejects(
      synologyPrivateJsonRequest('/webapi/entry.cgi'),
      /synology_json_too_large/
    );
  }

  {
    const https = createFakeHttps(({ callback }) => {
      const response = createFakeResponse(200, { 'content-type': 'application/pdf' });
      callback(response);
      response.emit('data', Buffer.alloc(33, 0x61));
    });
    const { downloadBufferFromSynologyPrivateFolder } =
      loadPrivateSynologyHttpHelpers(https);
    await assert.rejects(
      downloadBufferFromSynologyPrivateFolder('/home/termos-garantia/document.pdf'),
      /synology_download_too_large/
    );
  }

  {
    let destroyedWith = null;
    const https = createFakeHttps(({ request }) => {
      const originalDestroy = request.destroy;
      request.destroy = (error) => {
        destroyedWith = error;
        originalDestroy(error);
      };
      request.timeoutHandler();
    });
    const { synologyPrivateJsonRequest } = loadPrivateSynologyHttpHelpers(https);
    await assert.rejects(
      synologyPrivateJsonRequest('/webapi/entry.cgi', {
        timeoutCode: 'synology_upload_timeout',
      }),
      /synology_upload_timeout/
    );
    assert.match(destroyedWith.message, /synology_upload_timeout/);
  }
});
