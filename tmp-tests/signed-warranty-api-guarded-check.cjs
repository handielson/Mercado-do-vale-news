const assert = require('node:assert/strict');

const {
  SIGNED_WARRANTY_API_BASE_URL,
  SIGNED_WARRANTY_CUSTOMER_TOKEN,
  SIGNED_WARRANTY_ADMIN_TOKEN,
  SIGNED_WARRANTY_SALE_ID,
  SIGNED_WARRANTY_RUN_SYNC,
} = process.env;

const required = {
  SIGNED_WARRANTY_API_BASE_URL,
  SIGNED_WARRANTY_CUSTOMER_TOKEN,
  SIGNED_WARRANTY_SALE_ID,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.log(`signed warranty guarded API check skipped; missing ${missing.join(', ')}`);
  process.exit(0);
}

const baseUrl = SIGNED_WARRANTY_API_BASE_URL.replace(/\/+$/, '');

async function request(path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();

  assert.ok(
    response.ok,
    `${options.method || 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(body)}`
  );

  return { response, body };
}

(async () => {
  const salePath = `/sales/${encodeURIComponent(SIGNED_WARRANTY_SALE_ID)}/signed-warranty`;
  const { body: snapshot } = await request(salePath, SIGNED_WARRANTY_CUSTOMER_TOKEN);

  assert.equal(snapshot.sale_id, SIGNED_WARRANTY_SALE_ID);
  assert.ok(Object.prototype.hasOwnProperty.call(snapshot, 'active'));
  assert.ok(!Object.prototype.hasOwnProperty.call(snapshot, 'image_path'));
  assert.ok(!Object.prototype.hasOwnProperty.call(snapshot, 'pdf_path'));
  assert.deepEqual(snapshot.history, []);
  assert.deepEqual(snapshot.pending, []);

  if (snapshot.active) {
    assert.equal(snapshot.active.sale_id, SIGNED_WARRANTY_SALE_ID);
    assert.ok(snapshot.active.discard_message.includes('Documento físico digitalizado'));
    assert.ok(snapshot.active.discard_message.includes('destruído e descartado'));
    assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.active, 'image_path'));
    assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.active, 'pdf_path'));

    const pdfPath = `/signed-warranty/${encodeURIComponent(snapshot.active.id)}/pdf`;
    const { response, body } = await request(pdfPath, SIGNED_WARRANTY_CUSTOMER_TOKEN);
    assert.match(response.headers.get('content-type') || '', /application\/pdf/);
    assert.ok(Buffer.from(body).subarray(0, 4).equals(Buffer.from('%PDF')));
  }

  if (SIGNED_WARRANTY_RUN_SYNC === '1') {
    assert.ok(SIGNED_WARRANTY_ADMIN_TOKEN, 'SIGNED_WARRANTY_ADMIN_TOKEN is required to run sync');
    const { body: sync } = await request('/admin/signed-warranty/sync', SIGNED_WARRANTY_ADMIN_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(sync.started, true);
  }

  console.log('signed warranty guarded API check passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
