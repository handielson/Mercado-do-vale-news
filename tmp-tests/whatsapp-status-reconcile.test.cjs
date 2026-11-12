const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const rec = require('../services/whatsappStatusReconcile.cjs');

const env = { WAHA_STATUS_SERVER_URL: 'http://waha', WAHA_STATUS_API_KEY: 'k', WAHA_STATUS_SESSION: 's' };
const SENT = Date.parse('2026-11-12T11:00:00Z');

function waha(reply) {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, method: options.method }); return reply(url); };
  return { fetchImpl, calls };
}
const json = (status, body) => ({ ok: status < 300, status, json: async () => body });

// Banco falso: só o que o módulo usa.
function fakePool({ delivery, check = null }) {
  const db = { delivery: { ...delivery }, check: check && { ...check }, schedule: { status: 'failed' }, queries: [] };
  const pool = {
    db,
    async query(sql, params = []) {
      db.queries.push(sql);
      if (/^CREATE TABLE/.test(sql.trim())) return [[]];
      if (/^SHOW FULL COLUMNS/.test(sql)) return [[{ Collation: 'utf8mb4_unicode_ci' }]];
      if (/INSERT INTO social_story_delivery_checks/.test(sql)) {
        db.check = { delivery_id: params[0], sent_at: params[1], state: 'waiting', checks: 0, not_found_streak: 0, last_result: 'x' };
        return [{}];
      }
      if (/SELECT \* FROM social_story_delivery_checks/.test(sql)) return [[db.check].filter(Boolean)];
      if (/FROM social_story_deliveries d JOIN social_story_items/.test(sql)) return [[db.delivery]];
      if (/UPDATE social_story_delivery_checks SET state/.test(sql)) {
        Object.assign(db.check, { state: params[0], not_found_streak: params[1], last_result: params[2] }); db.check.checks++; return [{}];
      }
      if (/SET status='published'/.test(sql)) { if (db.delivery.status === 'failed') Object.assign(db.delivery, { status: 'published', provider_publication_id: params[0] }); return [{}]; }
      if (/SET status='pending'/.test(sql)) { if (db.delivery.status === 'failed') Object.assign(db.delivery, { status: 'pending', last_error: params[0] }); return [{}]; }
      if (/UPDATE social_story_schedules SET status='processing'/.test(sql)) { db.schedule.status = 'processing'; return [{}]; }
      if (/UPDATE social_story_deliveries SET last_error/.test(sql)) { db.delivery.last_error = params[0]; return [{}]; }
      throw new Error('SQL inesperado: ' + sql.slice(0, 80));
    },
  };
  return pool;
}
const baseDelivery = { id: 'd1', schedule_id: 's1', status: 'failed', destination: 'whatsapp', attempt_count: 1, media_type: 'video', caption: 'Redmi 15 por R$ 1.349', scheduled_at: new Date(SENT) };
const waitingCheck = (streak = 0) => ({ delivery_id: 'd1', sent_at: new Date(SENT), state: 'waiting', checks: streak, not_found_streak: streak });

test('acha o Status publicado pela legenda, tipo e horário', () => {
  const msgs = [
    { fromMe: true, timestamp: SENT / 1000 - 3600, body: 'Redmi 15 por R$ 1.349', _data: { type: 'video' } },
    { fromMe: true, timestamp: SENT / 1000 + 20, body: 'outra legenda', _data: { type: 'video' } },
    { fromMe: true, timestamp: SENT / 1000 + 25, body: 'Redmi 15  por R$ 1.349', _data: { type: 'image' } },
    { id: { _serialized: 'true_status@broadcast_ABC' }, fromMe: true, timestamp: SENT / 1000 + 30, body: 'Redmi 15 por R$ 1.349', _data: { type: 'video' } },
  ];
  assert.deepEqual(rec.findPublishedStatus(msgs, { sinceMs: SENT, type: 'video', caption: 'Redmi 15 por R$ 1.349' }).id, 'true_status@broadcast_ABC');
  assert.equal(rec.findPublishedStatus(msgs.slice(0, 3), { sinceMs: SENT, type: 'video', caption: 'Redmi 15 por R$ 1.349' }), null);
});

test('conferência usa a mesma normalização do ID WPP aninhado no envio', () => {
  const message = { id: null, _data: { id: { id: 'WPP-ID' }, type: 'video' }, fromMe: true,
    timestamp: SENT / 1000 + 10, body: 'legenda' };
  assert.equal(rec.findPublishedStatus([message], { sinceMs: SENT, type: 'video', caption: 'legenda' }).id, 'WPP-ID');
});

test('schema fixa collation e corrige instalação 849 existente sem repetir o ALTER', async () => {
  for (const initial of ['utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci']) {
    delete require.cache[require.resolve('../services/whatsappStatusReconcile.cjs')];
    const fresh = require('../services/whatsappStatusReconcile.cjs');
    const queries = [];
    const pool = { async query(sql) { queries.push(sql); return /^SHOW/.test(sql)
      ? [[{ Collation: initial }]] : [[]]; } };
    await fresh.ensureStatusCheckSchema(pool);
    await fresh.ensureStatusCheckSchema(pool);
    assert.match(queries[0], /DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/);
    assert.equal(queries.filter(q => q.startsWith('ALTER TABLE')).length, initial === 'utf8mb4_unicode_ci' ? 0 : 1);
    assert.ok(!queries.some(q => /DELETE|TRUNCATE|DROP TABLE/.test(q)));
  }
});

test('"Chat not found" = não publicado; outro erro = sem leitura', async () => {
  const notFound = waha(() => json(500, { exception: { message: 'Chat not found for status@broadcast' } }));
  assert.equal((await rec.verifyWahaStatusPublication({ sinceMs: SENT, type: 'video', caption: 'x', env, fetchImpl: notFound.fetchImpl })).state, 'not_published');
  const down = waha(() => json(502, {}));
  assert.equal((await rec.verifyWahaStatusPublication({ sinceMs: SENT, type: 'video', caption: 'x', env, fetchImpl: down.fetchImpl })).state, 'unknown');
  assert.ok(notFound.calls.every((c) => c.method === 'GET' && !/status\/(image|video)/.test(c.url)), 'conferência nunca publica');
});

test('publicado → entrega vira publicada com o id encontrado', async () => {
  const pool = fakePool({ delivery: baseDelivery, check: waitingCheck() });
  const { fetchImpl } = waha(() => json(200, [{ id: 'ID9', fromMe: true, timestamp: SENT / 1000 + 40, body: 'Redmi 15 por R$ 1.349', _data: { type: 'video' } }]));
  const r = await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl });
  assert.equal(r.state, 'published');
  assert.equal(pool.db.delivery.status, 'published');
  assert.equal(pool.db.delivery.provider_publication_id, 'ID9');
});

test('não publicado: 1ª leitura só aguarda; 2ª coloca o reenvio na fila e reabre o agendamento', async () => {
  const pool = fakePool({ delivery: baseDelivery, check: waitingCheck() });
  const { fetchImpl } = waha(() => json(200, []));
  assert.equal((await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl })).state, 'waiting');
  assert.equal(pool.db.delivery.status, 'failed');
  assert.equal((await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl })).state, 'retried');
  assert.equal(pool.db.delivery.status, 'pending');
  assert.equal(pool.db.schedule.status, 'processing');
  assert.match(pool.db.delivery.last_error, /tentativa 2 de 3/);
});

test('limite de tentativas: não reenvia mais e explica', async () => {
  const pool = fakePool({ delivery: { ...baseDelivery, attempt_count: 3 }, check: waitingCheck(1) });
  const { fetchImpl } = waha(() => json(200, []));
  assert.equal((await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl })).state, 'gave_up');
  assert.equal(pool.db.delivery.status, 'failed');
  assert.match(pool.db.delivery.last_error, /limite de 3 tentativas/);
});

test('botão do admin (force) reenvia já na primeira leitura; falha antiga sem registro usa o horário agendado', async () => {
  const pool = fakePool({ delivery: baseDelivery, check: null });
  const { fetchImpl } = waha(() => json(500, { exception: { message: 'Chat not found for status@broadcast' } }));
  const r = await rec.checkWhatsAppDelivery(pool, 'd1', { force: true, env, fetchImpl });
  assert.equal(r.state, 'retried');
  assert.equal(pool.db.delivery.status, 'pending');
});

test('sem leitura do WhatsApp: continua aguardando; após 6 h vira conferência manual', async () => {
  const pool = fakePool({ delivery: baseDelivery, check: waitingCheck() });
  const { fetchImpl } = waha(() => json(502, {}));
  assert.equal((await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl, now: () => SENT + 60 * 60 * 1000 })).state, 'unknown');
  assert.equal(pool.db.check.state, 'waiting');
  await rec.checkWhatsAppDelivery(pool, 'd1', { env, fetchImpl, now: () => SENT + 7 * 60 * 60 * 1000 });
  assert.equal(pool.db.check.state, 'unknown');
  assert.match(pool.db.delivery.last_error, /Confira no celular/);
  assert.equal(pool.db.delivery.status, 'failed');
});

test('entrega na fila ou já publicada não é mexida', async () => {
  for (const status of ['pending', 'processing', 'published']) {
    const pool = fakePool({ delivery: { ...baseDelivery, status }, check: waitingCheck() });
    const { fetchImpl, calls } = waha(() => json(200, []));
    const r = await rec.checkWhatsAppDelivery(pool, 'd1', { force: true, env, fetchImpl });
    assert.ok(['busy', 'published'].includes(r.state));
    assert.equal(calls.length, 0);
    assert.equal(pool.db.delivery.status, status);
  }
});

test('agendador registra incerteza do WhatsApp, confere a cada ciclo e o deploy envia o módulo', () => {
  const api = fs.readFileSync('services/marketingCampaignApi.cjs', 'utf8');
  assert.match(api, /error\?\.code === 'WAHA_STATUS_OUTCOME_UNCERTAIN'/);
  assert.match(api, /registerUncertainWhatsAppDelivery\(pool, delivery\.id, sendStartedAt\)/);
  assert.match(api, /reconcileWhatsAppStoryDeliveries\(pool/);
  assert.match(api, /\/admin\/marketing\/stories\/deliveries\/:id\/verify/);
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.equal((deploy.match(/services\/whatsappStatusReconcile\.cjs/g) || []).length >= 4, true);
  assert.match(fs.readFileSync('scripts/deploy-phone-price-list.cjs', 'utf8'), /'services\/whatsappStatusReconcile\.cjs'/);
});
