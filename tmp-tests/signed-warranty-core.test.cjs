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

test('cleans up both uploads and marks the reserved row error when activation commit fails', async () => {
  const primaryEvents = [];
  const errorEvents = [];
  let reservedId = null;
  const queryHandler = (sql, params) => {
    if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
    if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/SELECT id FROM sales/.test(sql)) return [[{ id: 'ab12cd34-sale' }]];
    if (/WHERE sale_id = \? AND image_sha256 = \?/.test(sql)) return [[]];
    if (/SELECT MAX\(version_number\)/.test(sql)) return [[{ max_version: 0 }]];
    if (/^INSERT INTO signed_warranty_documents/.test(sql)) {
      reservedId = params[0];
      return [{ affectedRows: 1 }];
    }
    if (/^UPDATE signed_warranty_documents/.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM signed_warranty_documents WHERE id/.test(sql)) {
      return [[{ id: reservedId, status: 'available' }]];
    }
    throw new Error(`unexpected_query:${sql}`);
  };
  queryHandler.commit = (commitCount) => {
    if (commitCount === 2) throw new Error('activation_commit_failed');
  };
  const primaryConnection = createConnection(queryHandler, primaryEvents);
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
    /activation_commit_failed/
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
