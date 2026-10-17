'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createShopeeShippingDocumentDownloader } = require('../services/shopeeShippingDocumentJob.cjs');

const pdf = Buffer.from('%PDF-1.7\nfixture');
const context = { scope: ['partner', 'shop', 'primary'], packageNumber: 'PKG-1', documentType: 'NORMAL_AIR_WAYBILL' };
const json = (response, status = 200) => new Response(JSON.stringify({ error: '', response }), {
  status, headers: { 'content-type': 'application/json' },
});
const apiError = (error, status = 200) => new Response(JSON.stringify({ error, message: 'Upstream error' }), {
  status, headers: { 'content-type': 'application/json' },
});
function fixture(options = {}) {
  const calls = [];
  let created = 0;
  const download = createShopeeShippingDocumentDownloader({
    wait: async () => {},
    ...options,
    request: async (path, body, ctx) => {
      const step = path.split('/').pop();
      calls.push({ step, body, context: ctx });
      const custom = await options.request?.(step, body, ctx, calls);
      if (custom) return custom;
      if (step === 'create_shipping_document_job') return json({ job_id: `JOB-${++created}`, fail_list: [] });
      if (step === 'get_shipping_document_job_status') return json({ job_status: 'READY' });
      if (step === 'download_shipping_document_job') return json({ media_link: 'https://files.shopee.test/label.pdf?signature=secret' });
      assert.fail(`Unexpected step: ${step}`);
    },
    fetchMedia: options.fetchMedia || (async () => new Response(pdf, { headers: { 'content-type': 'application/pdf' } })),
  });
  return { download, calls };
}

test('creates a package job, polls, obtains Filelink and downloads without forwarding credentials', async () => {
  let polls = 0;
  const f = fixture({
    request: step => step === 'get_shipping_document_job_status' ? json({ job_status: ++polls < 3 ? 'PROCESSING' : 'READY' }) : null,
    fetchMedia: async (url, options) => {
      assert.match(url, /^https:\/\/files.shopee.test\//);
      assert.deepEqual(Object.keys(options), ['signal']);
      return new Response(pdf, { headers: { 'content-type': 'application/octet-stream' } });
    },
  });
  const result = await f.download(context);
  assert.equal(result.status, 200);
  assert.deepEqual(result.buffer, pdf);
  assert.deepEqual(f.calls[0].body, { shipping_document_type: 'NORMAL_AIR_WAYBILL', package_list: ['PKG-1'] });
  assert.equal(polls, 3);
  for (const call of f.calls.slice(1)) assert.deepEqual(call.body, { job_id: 'JOB-1' });
  assert.doesNotMatch(JSON.stringify(result), /signature|media_link/);
});

test('handles files larger than 16 MB', async () => {
  const large = Buffer.alloc(17 * 1024 * 1024);
  pdf.copy(large);
  const f = fixture({ fetchMedia: async () => new Response(large) });
  assert.equal((await f.download(context)).buffer.length, large.length);
});

test('pending job is reused on the next request', async () => {
  let ready = false;
  const f = fixture({ request: step => step === 'get_shipping_document_job_status' ? json({ job_status: ready ? 'READY' : 'PROCESSING' }) : null });
  const pending = await f.download(context);
  assert.equal(pending.status, 202);
  assert.equal(pending.data.error, 'shipping_document_processing');
  assert.equal(f.calls.filter(x => x.step === 'get_shipping_document_job_status').length, 8);
  assert.ok(!f.calls.some(x => x.step === 'download_shipping_document_job'));
  ready = true;
  assert.equal((await f.download(context)).status, 200);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 1);
});

test('jobs stay isolated by shop, connection, package and document type', async () => {
  const f = fixture();
  for (const c of [context, { ...context, scope: ['partner', 'shop-2', 'primary'] },
    { ...context, scope: ['partner', 'shop', 'glaucia'] }, { ...context, packageNumber: 'PKG-2' },
    { ...context, documentType: 'THERMAL_AIR_WAYBILL' }, context]) {
    assert.equal((await f.download(c)).status, 200);
  }
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 5);
  assert.equal(f.calls.filter(x => x.step === 'download_shipping_document_job').length, 6);
});

test('concurrent downloads of the same label share one job', async () => {
  const f = fixture();
  const results = await Promise.all([f.download(context), f.download(context)]);
  assert.ok(results.every(x => x.status === 200));
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 1);
});

for (const status of ['EXPIRED', 'FAILED']) test(`${status} job is recreated once`, async () => {
  const f = fixture({ request: (step, body) => step === 'get_shipping_document_job_status' && body.job_id === 'JOB-1' ? json({ job_status: status }) : null });
  assert.equal((await f.download(context)).status, 200);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 2);
});

test('repeated failures stop without an endless recreation loop', async () => {
  const f = fixture({ request: step => step === 'get_shipping_document_job_status' ? json({ job_status: 'FAILED' }) : null });
  assert.equal((await f.download(context)).status, 502);
  assert.equal(f.calls.length, 4);
});

for (const error of ['logistics.sd_file_expired', 'logistics.sd_job_print_failed']) test(`${error} triggers one new job`, async () => {
  const f = fixture({ request: (step, body) => step === 'download_shipping_document_job' && body.job_id === 'JOB-1' ? apiError(error) : null });
  assert.equal((await f.download(context)).status, 200);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 2);
});

test('expired media link is renewed with the same job', async () => {
  let downloads = 0;
  const f = fixture({ fetchMedia: async () => ++downloads === 1 ? new Response('', { status: 403 }) : new Response(pdf) });
  assert.equal((await f.download(context)).status, 200);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 1);
  assert.equal(f.calls.filter(x => x.step === 'download_shipping_document_job').length, 2);
});

test('download_later remains pending and preserves job', async () => {
  const f = fixture({ request: step => step === 'download_shipping_document_job' ? apiError('logistics.download_later') : null });
  assert.equal((await f.download(context)).status, 202);
  assert.equal((await f.download(context)).status, 202);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 1);
});

test('supports direct PDF from the new endpoint while Shopee rolls out Filelink', async () => {
  const f = fixture({
    request: step => step === 'download_shipping_document_job' ? new Response(pdf, { headers: { 'content-type': 'application/pdf' } }) : null,
    fetchMedia: () => assert.fail('No media fetch for direct PDF'),
  });
  assert.deepEqual((await f.download(context)).buffer, pdf);
});

for (const step of ['create_shipping_document_job', 'get_shipping_document_job_status', 'download_shipping_document_job']) {
  test(`propagates ${step} API errors and stops`, async () => {
    const f = fixture({ request: s => s === step ? apiError('error_auth', 401) : null });
    const result = await f.download(context);
    assert.equal(result.status, 401);
    assert.equal(result.data.error, 'error_auth');
    assert.equal(f.calls.at(-1).step, step);
  });
}

test('rejects a per-package failure even when the API reports global success', async () => {
  const f = fixture({ request: step => step === 'create_shipping_document_job'
    ? json({ job_id: 'JOB-1', fail_list: [{ id: 'PKG-1', fail_error: 'error_param', fail_message: 'Invalid package' }] }) : null });
  assert.equal((await f.download(context)).data.error, 'error_param');
  assert.equal(f.calls.length, 1);
});

test('rejects a missing job ID', async () => {
  const f = fixture({ request: step => step === 'create_shipping_document_job' ? json({}) : null });
  assert.equal((await f.download(context)).data.error, 'shipping_document_job_missing');
  assert.equal(f.calls.length, 1);
});

for (const media_link of [undefined, 'http://files.shopee.test/label', 'https://user:password@files.shopee.test/label']) {
  test(`rejects invalid or insecure link ${media_link}`, async () => {
    const f = fixture({ request: step => step === 'download_shipping_document_job' ? json({ media_link }) : null });
    assert.equal((await f.download(context)).data.error, 'shipping_document_link_invalid');
  });
}

test('rejects HTML returned by a media server instead of printing it', async () => {
  const f = fixture({ fetchMedia: async () => new Response('<html>expired</html>') });
  assert.equal((await f.download(context)).data.error, 'shipping_document_invalid_pdf');
});

test('network failure is sanitized and can be retried', async () => {
  const f = fixture({ fetchMedia: () => { throw new Error('https://files.shopee.test/?signature=SECRET'); } });
  const results = await Promise.all([f.download(context), f.download(context)]);
  assert.ok(results.every(x => x.status === 502));
  assert.doesNotMatch(JSON.stringify(results), /SECRET|signature/);
});

test('cache expires jobs without retaining links', async () => {
  let clock = 0;
  const f = fixture({ now: () => clock });
  await f.download(context);
  clock += 31 * 60 * 1000;
  await f.download(context);
  assert.equal(f.calls.filter(x => x.step === 'create_shipping_document_job').length, 2);
});

test('rejects unknown job status without downloading', async () => {
  const f = fixture({ request: step => step === 'get_shipping_document_job_status' ? json({ job_status: 'UNKNOWN' }) : null });
  assert.equal((await f.download(context)).data.error, 'shipping_document_job_status_invalid');
  assert.equal(f.calls.length, 2);
});

test('permanent media failure stops after renewing the link once', async () => {
  const f = fixture({ fetchMedia: async () => new Response('', { status: 403 }) });
  assert.equal((await f.download(context)).status, 502);
  assert.equal(f.calls.filter(x => x.step === 'download_shipping_document_job').length, 2);
});

test('concurrent upstream request failures are sanitized for all callers', async () => {
  const f = fixture({ request: () => { throw new Error('Request failed with token=SECRET'); } });
  const results = await Promise.all([f.download(context), f.download(context)]);
  assert.ok(results.every(x => x.status === 502));
  assert.doesNotMatch(JSON.stringify(results), /SECRET/);
});

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  test(`${file} raw transport refreshes credentials and keeps PDF/JSON responses readable`, async () => {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('async function shopeeCatalogRequestVps(');
    const end = source.indexOf('async function shopeeCatalogGetVps(', start);
    const tokens = [];
    let binary = false;
    const request = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
      fetch: async url => {
        tokens.push(url);
        if (url === 'old') return apiError('error_auth');
        return binary ? new Response(pdf, { headers: { 'content-type': 'application/pdf' } }) : json({ job_id: 'JOB-1' });
      },
      buildShopeeCatalogUrlVps: (_path, creds) => creds.accessToken,
      AbortSignal,
      readShopeeCatalogJsonResponseVps: response => response.json(),
      isRetryableShopeeAuthErrorVps: data => data.error === 'error_auth',
      refreshShopeeCatalogTokenVps: async creds => ({ ...creds, accessToken: 'new' }),
    });
    const creds = { accessToken: 'old' };
    const raw = await request('POST', '/download', creds, {}, '', false, true);
    assert.equal((await raw.json()).response.job_id, 'JOB-1');
    assert.equal(creds.accessToken, 'new');
    binary = true;
    const direct = await request('POST', '/download', creds, {}, '', false, true);
    assert.deepEqual(Buffer.from(await direct.arrayBuffer()), pdf);
    binary = false;
    const regular = await request('POST', '/status', creds, {});
    assert.equal(regular.data.response.job_id, 'JOB-1');
    assert.equal(regular.status, 200);
    assert.equal(regular.ok, true);
    assert.deepEqual(tokens, ['old', 'new', 'new', 'new']);
  });

  test(`${file} preserves POST guard, job errors, PDF bytes and A4 output`, async () => {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf("      case 'get_shipping_document': {");
    const end = source.indexOf("\n      case '", start + 1);
    const handler = vm.runInNewContext(`(async (payload, reply, request) => {\n${source.slice(start, end).replace("case 'get_shipping_document': {", '{')}\n})`, {
      creds: { partnerId: 'partner', shopId: 'shop' }, connectionId: 'glaucia',
      requireShopeeActionsPostVps: request => request.method !== 'POST',
      shopeeCatalogGetVps: async () => ({ data: { response: { order_list: [{ package_list: [{ package_number: 'PKG-1' }] }] } } }),
      encodeShopeeCatalogParamsVps: () => '', firstShopeeActionsNonEmptyVps: value => value,
      downloadShopeeShippingDocumentVps: async ctx => {
        assert.deepEqual(Array.from(ctx.scope), ['partner', 'shop', 'glaucia']);
        assert.equal(ctx.packageNumber, 'PKG-1');
        return currentDocument;
      },
      expandShopeeShippingLabelToA4Vps: async buffer => Buffer.concat([buffer, Buffer.from('A4')]),
    });
    function reply() { return { status: 0, headers: {}, code(n) { this.status = n; return this; }, header(k, v) { this.headers[k] = v; return this; }, send(data) { this.data = data; return this; } }; }
    let currentDocument = { status: 200, buffer: pdf };
    const res = await handler({ order_sn: 'ORDER-1' }, reply(), { method: 'POST' });
    assert.deepEqual(res.data, pdf);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(res.headers['Content-Disposition'], 'attachment; filename="etiqueta-ORDER-1.pdf"');
    const a4 = await handler({ order_sn: 'ORDER-1', full_page_a4: true }, reply(), { method: 'POST' });
    assert.equal(a4.data.toString(), pdf.toString() + 'A4');
    currentDocument = { status: 202, data: { error: 'shipping_document_processing' } };
    const pending = await handler({ order_sn: 'ORDER-1' }, reply(), { method: 'POST' });
    assert.equal(pending.status, 202);
    assert.deepEqual(pending.data, currentDocument.data);
    assert.equal(await handler({}, reply(), { method: 'GET' }), undefined);
    assert.doesNotMatch(source.slice(start, end), /\/api\/v2\/logistics\/(create_shipping_document|get_shipping_document_result|download_shipping_document)['"]/);
  });
}
