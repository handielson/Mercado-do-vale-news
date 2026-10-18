'use strict';

const { WEBHOOK_PATH, sameSecret, verifySignature, normalizeEnvelope } = require('./metaAttendanceCore.cjs');
const { createMetaAttendanceReplies, replyConfig } = require('./metaAttendanceReplies.cjs');
const BODY_LIMIT = 1024 * 1024;

function attendanceConfig(env = process.env) {
  return {
    enabled: env.META_ATTENDANCE_ENABLED === 'true',
    appSecret: env.META_APP_SECRET || '',
    verifyToken: env.META_ATTENDANCE_VERIFY_TOKEN || '',
  };
}

async function selectedAssets(pool) {
  const [rows] = await pool.query('SELECT selected_page_id, selected_instagram_account_id FROM meta_marketing_connections WHERE id=1 LIMIT 1');
  return { pageId: rows[0]?.selected_page_id || null, instagramAccountId: rows[0]?.selected_instagram_account_id || null };
}

// Acknowledge a batch only after commit. A failed batch is retried by Meta, not lost in a detached promise.
async function persistEvents(pool, events) {
  if (!events.length) return;
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    for (const event of events) {
      await db.query(`INSERT INTO meta_attendance_events
        (event_key,channel,account_id,participant_id,conversation_key,provider_event_id,surface,event_type,status,normalized_event)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_key=VALUES(event_key)`, [
        event.eventKey, event.channel, event.accountId, event.participantId, event.conversationKey,
        event.providerEventId, event.surface, event.eventType, event.status, JSON.stringify(event),
      ]);
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { db.release(); }
}

function configured(config) {
  return config.enabled && Boolean(config.appSecret) && config.verifyToken.length >= 32;
}

function registerMetaAttendanceRoutes(fastify, { pool, requireAdminBearerToken, getConfig = attendanceConfig }) {
  const replies = createMetaAttendanceReplies({pool});
  let replyTimer = null;
  let running = false;
  fastify.addHook('onReady', async () => {
    if (!replyConfig().enabled) return;
    const run = async () => { if (running) return; running = true; try { await replies.tick(); } catch { /* Retry database availability on the next tick; no upstream details enter logs. */ } finally { running = false; } };
    replyTimer = setInterval(() => { void run(); }, 1500);
    replyTimer.unref();
  });
  fastify.addHook('onClose', async () => { if(replyTimer)clearInterval(replyTimer); });
  fastify.route({method:['GET','POST'],url:'/internal/meta/attendance/n8n/:operation',
    preHandler:async(req,reply)=>{
      if(!sameSecret(req.headers['x-sync-key'],process.env.SYNC_SECRET))return reply.code(401).send({error:'unauthorized'});
    },handler:async(req,reply)=>{
      reply.header('Cache-Control','no-store');
      const operation=req.params.operation;
      if(!['context','log','state','preferences','handoff','freshness','reset'].includes(operation))return reply.code(404).send({error:'operation_not_found'});
      if(req.method!==(['context','freshness'].includes(operation)?'GET':'POST'))return reply.code(405).send({error:'invalid_method'});
      try{return await replies.operate(operation,req.query?.eventKey,req.body||{});}
      catch(error){return reply.code(error.statusCode===400?400:503).send({error:'meta_attendance_operation_failed'});}
    }});
  // This parser is encapsulated in this plugin. Other JSON APIs retain their own parser and limits.
  fastify.register(async app => {
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: BODY_LIMIT }, (_req, body, done) => done(null, body));

    app.get(WEBHOOK_PATH, async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      const config = getConfig();
      if (!configured(config)) return reply.code(503).send({ error: 'meta_attendance_not_configured' });
      const query = req.query || {};
      if (query['hub.mode'] !== 'subscribe' || !sameSecret(query['hub.verify_token'], config.verifyToken)
        || typeof query['hub.challenge'] !== 'string' || query['hub.challenge'].length > 1024) {
        return reply.code(403).send({ error: 'invalid_webhook_verification' });
      }
      return reply.type('text/plain').send(query['hub.challenge']);
    });

    app.post(WEBHOOK_PATH, { bodyLimit: BODY_LIMIT }, async (req, reply) => {
      const config = getConfig();
      if (!configured(config)) return reply.code(503).send({ error: 'meta_attendance_not_configured' });
      if (!verifySignature(req.body, req.headers['x-hub-signature-256'], config.appSecret)) {
        return reply.code(403).send({ error: 'invalid_webhook_signature' });
      }
      let body;
      try { body = JSON.parse(req.body.toString('utf8')); }
      catch { return reply.code(400).send({ error: 'invalid_json' }); }
      try {
        const { events } = normalizeEnvelope(body, await selectedAssets(pool));
        await persistEvents(pool, events);
        return reply.type('text/plain').send('EVENT_RECEIVED');
      } catch (error) {
        if ([400, 413].includes(error.statusCode)) return reply.code(error.statusCode).send({ error: error.message });
        // Database/SQL errors must not reveal customer text, payloads or credentials.
        return reply.code(503).header('Retry-After', '30').send({ error: 'meta_attendance_storage_unavailable' });
      }
    });
  });

  fastify.get('/admin/marketing/meta/attendance/status', { preHandler: requireAdminBearerToken }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const config = getConfig(), assets = await selectedAssets(pool);
      let storageReady = false;
      try { await pool.query('SELECT id FROM meta_attendance_events LIMIT 0'); storageReady = true; } catch {}
      let runtime = null, activity = [];
      try {
        runtime = (await pool.query('SELECT enabled,activation_at FROM meta_attendance_runtime WHERE id=1'))[0][0];
        activity = (await pool.query(`SELECT status,COUNT(*) AS count FROM meta_attendance_jobs GROUP BY status`))[0];
      } catch {}
      const bridge=replyConfig();
      const outboundEnabled=bridge.enabled && Boolean(runtime?.enabled) && bridge.n8nKey.length>=32 && Boolean(bridge.n8nUrl);
      return {
        ok: true, mode: outboundEnabled?'automatic_replies':'capture_only',outboundEnabled,
        n8nConnected:bridge.enabled&&bridge.n8nKey.length>=32&&Boolean(bridge.n8nUrl),activationAt:runtime?.activation_at||null,activity,
        enabled: config.enabled, configured: configured(config), storageReady, webhookPath: WEBHOOK_PATH, ...assets,
      };
    } catch { return reply.code(503).send({ error: 'meta_attendance_status_unavailable' }); }
  });

  fastify.get('/admin/marketing/meta/attendance/events', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const channel = req.query?.channel;
    if (channel && !['instagram', 'messenger'].includes(channel)) return reply.code(400).send({ error: 'invalid_channel' });
    const rawLimit = req.query?.limit ?? '25';
    if (!/^\d+$/.test(String(rawLimit)) || Number(rawLimit) < 1 || Number(rawLimit) > 100) return reply.code(400).send({ error: 'invalid_limit' });
    try {
      const assets = await selectedAssets(pool);
      const params = [assets.pageId, assets.instagramAccountId];
      const filter = channel ? ' AND channel=?' : '';
      if (channel) params.push(channel);
      const [rows] = await pool.query(`SELECT CAST(id AS CHAR) AS id,channel,account_id,participant_id,surface,event_type,status,normalized_event,received_at
        FROM meta_attendance_events WHERE ((channel='messenger' AND account_id=?) OR (channel='instagram' AND account_id=?))${filter}
        ORDER BY id DESC LIMIT ${Number(rawLimit)}`, params);
      return { ok: true, mode: 'capture_only', rows: rows.map(row => ({ ...row, normalized_event: typeof row.normalized_event === 'string' ? JSON.parse(row.normalized_event) : row.normalized_event })) };
    } catch { return reply.code(503).send({ error: 'meta_attendance_storage_unavailable' }); }
  });
}

module.exports = { attendanceConfig, persistEvents, registerMetaAttendanceRoutes };
