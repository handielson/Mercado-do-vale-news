const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Fastify = require('fastify');
const { PDFDocument, PDFName } = require('pdf-lib');
const { hash, validatePdf, printOptions, normalizeInventory } = require('../services/centralPrintingCore.cjs');
const { executeJob, startCentralPrintAgent } = require('../scripts/central-print-agent.cjs');
const { registerCentralPrintingRoutes } = require('../services/centralPrintingServer.cjs');
const destination = 'P50 Printer';
const inventory = [{ name: destination, status: 'ready', papers: [{ name: '30x20', kind: 257, widthMm: 30, heightMm: 20 }] }];
async function pdf(pages = 3, width = 30, height = 20) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([width * 72 / 25.4, height * 72 / 25.4]).drawText('Teste', { x: 3, y: 12, size: 8 });
  return Buffer.from(await doc.save());
}
test('PDF: exact dimensions and pages; settings cannot replace actual document', async () => {
  const bytes = await pdf();
  const result = await validatePdf(bytes.toString('base64'), { widthMm: 30, heightMm: 20, pages: 3 });
  assert.equal(result.pages, 3); assert.ok(Math.abs(result.widthMm - 30) < 0.01);
  assert.equal(result.hash, hash(bytes)); assert.deepEqual(result.buffer, bytes);
  await assert.rejects(validatePdf(bytes.toString('base64'), { pages: 9 }), /diverge/);
  await assert.rejects(validatePdf(bytes.toString('base64'), { widthMm: 50 }), /diverge/);
  await assert.rejects(validatePdf('YXNk'), /PDF/);
});
test('PDF: real jsPDF label keeps initial page view but rejects autoPrint action', async () => {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: [30, 20], orientation: 'landscape' });
  doc.text('Teste P50', 2, 5);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  const valid = await validatePdf(bytes.toString('base64'), { widthMm: 30, heightMm: 20, pages: 1 });
  assert.deepEqual(valid.buffer, bytes);
  doc.autoPrint();
  await assert.rejects(validatePdf(Buffer.from(doc.output('arraybuffer')).toString('base64')), /scripts|automática/);
});
test('PDF: reject scripts, mixed page sizes and encrypted/broken data', async () => {
  const doc = await PDFDocument.load(await pdf(1));
  doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'JavaScript', JS: 'print()' }));
  await assert.rejects(validatePdf(Buffer.from(await doc.save()).toString('base64')), /scripts|automática/);
  const mixed = await PDFDocument.create(); mixed.addPage([85, 56]); mixed.addPage([200, 300]);
  await assert.rejects(validatePdf(Buffer.from(await mixed.save()).toString('base64')), /mesmo tamanho/);
  await assert.rejects(validatePdf(Buffer.from('%PDF-corrupt').toString('base64')), /ilegível/);
});
test('printer mapping preserves scale and never multiplies already expanded copies', () => {
  const options = printOptions({ printer_name: destination, width_mm: 30, height_mm: 20, pages: 50 }, inventory);
  assert.deepEqual(options, { printer: destination, paperKind: 257, orientation: 'landscape', scale: 'noscale', copies: 1, side: 'simplex' });
  assert.equal(printOptions({ printer_name: destination, width_mm: 20, height_mm: 30 }, inventory).orientation, 'portrait');
  assert.throws(() => printOptions({ printer_name: destination, width_mm: 40, height_mm: 30 }, inventory), /tamanho/);
  assert.throws(() => printOptions({ printer_name: 'wrong', width_mm: 30, height_mm: 20 }, inventory), /disponível/);
  assert.throws(() => printOptions({ printer_name: destination, width_mm: 30, height_mm: 20 }, [{ ...inventory[0], status: 'offline' }]), /disponível/);
});
test('heartbeat only accepts configured destinations and bounded paper capabilities', () => {
  const rows = normalizeInventory([...inventory, ...inventory, { name: 'unknown', papers: [] }], [destination]);
  assert.equal(rows.length, 1); assert.equal(rows[0].papers.length, 1);
});
async function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-print-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true })); // exact fresh test directory only
  const bytes = await pdf();
  const job = { id: crypto.randomUUID(), claimToken: crypto.randomUUID(), printer_name: destination, width_mm: 30, height_mm: 20, pages: 3, pdf_hash: hash(bytes) };
  const calls = [];
  const options = { job, inventory, directory,
    request: async route => { calls.push(route); return route.endsWith('/pdf') ? bytes : { ok: true }; },
    print: async (_, opts) => { calls.push('physical'); assert.equal(opts.copies, 1); assert.equal(opts.scale, 'noscale'); },
    report: async (_, status) => { calls.push(status); }, ...overrides };
  return { options, calls, job, directory, bytes };
}
test('agent sends unchanged PDF once, journals before printing and suppresses duplicate delivery', async t => {
  const f = await fixture(t);
  f.options.print = async (file, opts) => {
    assert.deepEqual(fs.readFileSync(file), f.bytes);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, `${f.job.id}.json`))).status, 'sending');
    assert.equal(opts.copies, 1); f.calls.push('physical');
  };
  await executeJob(f.options); await executeJob(f.options);
  assert.equal(f.calls.filter(c => c === 'physical').length, 1);
  assert.equal(f.calls.filter(c => c === 'submitted').length, 2);
});
test('agent failure after spooler invocation is uncertain and cannot automatically print again', async t => {
  let attempts = 0;
  const f = await fixture(t, { print: async () => { attempts++; throw new Error('spooler connection lost'); } });
  await executeJob(f.options); await executeJob(f.options);
  assert.equal(attempts, 1); assert.ok(f.calls.includes('uncertain'));
});
test('agent validates checksum before touching spooler', async t => {
  const f = await fixture(t); f.job.pdf_hash = '0'.repeat(64);
  await executeJob(f.options);
  assert.ok(f.calls.includes('failed')); assert.ok(!f.calls.includes('physical'));
});
test('network loss after successful spooler call retains submitted journal', async t => {
  const f = await fixture(t, { report: async () => { throw new Error('offline'); } });
  await assert.rejects(executeJob(f.options), /offline/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, `${f.job.id}.json`))).status, 'submitted');
  f.options.report = async () => {};
  await executeJob(f.options);
  assert.equal(f.calls.filter(c => c === 'physical').length, 1);
});
test('custom paper requires prepared isolated queue with matching dimensions', async t => {
  const customInventory = [{ ...inventory[0], papers: [], customSize: true }];
  const f = await fixture(t, { inventory: customInventory, preparePaper: async () => ({ printer: 'MDV Central ABC', widthMm: 30, heightMm: 20 }) });
  let received;
  f.options.print = async (_, options) => { received = options; };
  await executeJob(f.options); assert.equal(received.printer, 'MDV Central ABC'); assert.equal(received.scale, 'noscale');
  assert.equal(received.orientation, 'landscape');
  const bad = await fixture(t, { inventory: customInventory, preparePaper: async () => ({ printer: 'MDV Central ABC', widthMm: 50, heightMm: 20 }) });
  await executeJob(bad.options); assert.ok(bad.calls.includes('failed')); assert.ok(!bad.calls.includes('physical'));
});
test('disabled agent performs no work, preserving current Shopee behavior', () => {
  assert.equal(startCentralPrintAgent({ env: {} }), null);
});
async function api(t, query, auth = { isAdmin: true, userId: 'admin-test' }) {
  const app = Fastify();
  const db = { query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  const pool = { ...db, getConnection: async () => db };
  registerCentralPrintingRoutes(app, { pool, getBearerAuthContext: async () => auth, enabled: true });
  await app.ready(); t.after(() => app.close()); return app;
}
test('reprint preserves MySQL JSON settings returned as object or serialized text', async t => {
  const settings = { widthMm: 30, heightMm: 20, pages: 1, labelName: 'Etiqueta' };
  for (const stored of [settings, JSON.stringify(settings)]) {
    const original = { id: crypto.randomUUID(), device_id: crypto.randomUUID(), printer_name: destination,
      title: 'Etiqueta', status: 'submitted', pdf_data: await pdf(1), pdf_hash: 'hash', width_mm: 30, height_mm: 20, pages: 1, settings_json: stored };
    let inserted;
    const app = await api(t, async (sql, params) => {
      if (sql.includes('SELECT * FROM central_print_jobs')) return [[original]];
      if (sql.includes('SELECT id,reprint_of')) return [[]];
      if (sql.includes('SELECT id FROM central_print_devices')) return [[{ id: original.device_id }]];
      if (sql.includes('INSERT INTO central_print_jobs')) inserted = params;
      return [{ affectedRows: 1 }];
    });
    const result = await app.inject({ method: 'POST', url: `/admin/printing/jobs/${original.id}/reprint`,
      payload: { reason: 'Orientacao corrigida', idempotencyKey: crypto.randomUUID() } });
    assert.equal(result.statusCode, 200);
    assert.equal(typeof inserted[12], 'string');
    assert.deepEqual(JSON.parse(inserted[12]), settings);
    assert.deepEqual(inserted[8], original.pdf_data);
  }
});
test('API rejects sync keys and non-admin sessions on every administration route', async t => {
  const app = await api(t, async () => { throw new Error('must not query'); }, { isAdmin: false });
  for (const [method, url] of [['GET', '/admin/printing/devices'], ['POST', '/admin/printing/devices'], ['GET', '/admin/printing/jobs'], ['POST', '/admin/printing/jobs'], ['POST', '/admin/printing/jobs/x/reprint'], ['POST', '/admin/printing/jobs/x/cancel']]) {
    assert.equal((await app.inject({ method, url, headers: { 'x-sync-key': 'global-key' }, ...(method === 'POST' ? { payload: {} } : {}) })).statusCode, 401);
  }
});
test('device token cannot impersonate admin or another device; expired/revoked tokens rejected', async t => {
  const id = crypto.randomUUID(); const secret = 'a'.repeat(64);
  const app = await api(t, async () => [[{ id, secret_hash: hash(secret), allowed_printers: JSON.stringify([destination]) }]], { isAdmin: false });
  assert.equal((await app.inject({ method: 'GET', url: '/admin/printing/jobs', headers: { authorization: `Bearer ${id}.${secret}` } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/printing/agent/heartbeat', payload: { printers: inventory }, headers: { authorization: `Bearer ${id}.${'b'.repeat(64)}` } })).statusCode, 401);
  const revoked = await api(t, async () => [[]]);
  assert.equal((await revoked.inject({ method: 'POST', url: '/printing/agent/heartbeat', payload: {}, headers: { authorization: `Bearer ${id}.${secret}` } })).statusCode, 401);
});
test('API uses real PDF hash and idempotency key to return previous work, not another insertion', async t => {
  const bytes = await pdf(); const key = crypto.randomUUID(); const deviceId = crypto.randomUUID(); const jobId = crypto.randomUUID();
  const settings = { widthMm: 30, heightMm: 20, pages: 3 };
  const fingerprint = hash(JSON.stringify([deviceId, destination, 'Teste', hash(bytes), JSON.stringify(settings)]));
  const app = await api(t, async sql => {
    assert.match(sql, /WHERE requested_by=\? AND idempotency_key=\?/);
    return [[{ id: jobId, status: 'queued', request_hash: fingerprint }]];
  });
  const payload = { idempotencyKey: key, deviceId, printerName: destination, title: 'Teste', settings, pdfBase64: bytes.toString('base64') };
  const result = await app.inject({ method: 'POST', url: '/admin/printing/jobs', payload });
  assert.equal(result.statusCode, 200); assert.equal(result.json().id, jobId); assert.equal(result.json().request_hash, undefined);
  const conflict = await app.inject({ method: 'POST', url: '/admin/printing/jobs', payload: { ...payload, title: 'Outro' } });
  assert.equal(conflict.statusCode, 409);
});

test('concurrent claims serialize on device lock; one job has exactly one consumer', async t => {
  const app = Fastify(); t.after(() => app.close());
  const id = crypto.randomUUID(), secret = 'a'.repeat(64);
  const device = { id, secret_hash: hash(secret), allowed_printers: JSON.stringify([destination]), inventory: JSON.stringify(inventory) };
  const job = { id: crypto.randomUUID(), status: 'queued', printer_name: destination };
  const queries = []; let tail = Promise.resolve();
  const query = async (sql, args) => {
    queries.push(sql);
    if (sql.includes('FROM central_print_devices')) return [[device]];
    if (sql.startsWith('INSERT INTO central_print_events')) return [{ affectedRows: 1 }];
    if (sql.includes('lease_until < NOW()')) return [[]];
    if (sql.includes("status IN ('reserved','sending') LIMIT 1")) return [job.status === 'reserved' ? [{ id: job.id }] : []];
    if (sql.includes("status='queued' ORDER BY")) return [[{ ...job }]];
    if (sql.startsWith("UPDATE central_print_jobs SET status='reserved'")) { job.status = 'reserved'; job.claim_token = args[0]; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const pool = { query, getConnection: async () => {
    let unlock;
    return { query,
      beginTransaction: async () => { const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous; },
      commit: async () => unlock(), rollback: async () => unlock(), release: () => {},
    };
  } };
  registerCentralPrintingRoutes(app, { pool, getBearerAuthContext: async () => ({ isAdmin: false }), enabled: true });
  const claim = () => app.inject({ method: 'POST', url: '/printing/agent/claim', payload: { printerName: destination }, headers: { authorization: `Bearer ${id}.${secret}` } });
  const responses = await Promise.all([claim(), claim()]);
  assert.ok(responses.every(r => r.statusCode === 200));
  assert.equal(responses.filter(r => r.json().job).length, 1);
  assert.ok(queries.findIndex(sql => sql.includes('FOR UPDATE')) < queries.findIndex(sql => sql.startsWith("UPDATE central_print_jobs SET status='reserved'")));
});

test('result transitions reject stale claims and failed-to-submitted escalation, allow idempotent acknowledgements', async t => {
  const id = crypto.randomUUID(), secret = 'a'.repeat(64), claim = crypto.randomUUID(), jobId = crypto.randomUUID();
  let state = 'sending', events = 0;
  const app = await api(t, async (sql, args) => {
    if (sql.includes('FROM central_print_devices')) return [[{ id, secret_hash: hash(secret) }]];
    if (sql.startsWith('SELECT status,claim_token')) return [[{ status: state, claim_token: claim }]];
    if (sql.startsWith('UPDATE central_print_jobs SET status=')) { state = args[0]; return [{ affectedRows: 1 }]; }
    if (sql.startsWith('INSERT INTO central_print_events')) { events++; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const result = (status, claimToken = claim) => app.inject({ method: 'POST', url: `/printing/agent/jobs/${jobId}/result`,
    headers: { authorization: `Bearer ${id}.${secret}` }, payload: { status, claimToken } });
  assert.equal((await result('submitted', 'wrong')).statusCode, 409); assert.equal(state, 'sending');
  assert.equal((await result('submitted')).statusCode, 200); assert.equal(state, 'submitted');
  assert.equal((await result('submitted')).statusCode, 200); assert.equal(events, 1);
  state = 'failed'; assert.equal((await result('submitted')).statusCode, 409);
  state = 'uncertain'; assert.equal((await result('submitted')).statusCode, 200);
});

test('PDF download is private to current unexpired claim on its device', async t => {
  const id = crypto.randomUUID(), secret = 'a'.repeat(64);
  let parameters;
  const app = await api(t, async (sql, args) => {
    if (sql.includes('FROM central_print_devices')) return [[{ id, secret_hash: hash(secret) }]];
    assert.match(sql, /device_id=\? AND claim_token=\? AND status='reserved' AND lease_until>NOW\(\)/);
    parameters = args; return [[]];
  });
  const response = await app.inject({ method: 'GET', url: '/printing/agent/jobs/another/pdf', headers: { authorization: `Bearer ${id}.${secret}`, 'x-print-claim': 'stale' } });
  assert.equal(response.statusCode, 409); assert.deepEqual(parameters, ['another', id, 'stale']);
});
