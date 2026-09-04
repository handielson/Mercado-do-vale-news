const crypto = require('crypto');
const { problem, hash, text, json, matchPaper, normalizeInventory, validatePdf } = require('./centralPrintingCore.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PUBLIC_JOB_FIELDS = 'id, device_id, printer_name, title, requested_by, width_mm, height_mm, pages, status, attempts, last_error, reprint_of, created_at, updated_at';

function registerCentralPrintingRoutes(app, { pool, getBearerAuthContext, enabled = process.env.MDV_CENTRAL_PRINT_ENABLED === '1' }) {
  // Explicit release switch; no reads of absent tables and no automatic migrations.
  if (!enabled) return;
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error: 'Sessão de administrador necessária.' });
    req.printActor = String(auth.userId);
  };
  const device = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
    const [id, secret] = token.split('.');
    if (!UUID.test(id || '') || !/^[a-f0-9]{64}$/.test(secret || '')) return reply.code(401).send({ error: 'Dispositivo não autorizado.' });
    const [rows] = await pool.query('SELECT * FROM central_print_devices WHERE id=? AND enabled=1', [id]);
    const row = rows[0];
    if (!row || !crypto.timingSafeEqual(Buffer.from(row.secret_hash, 'hex'), Buffer.from(hash(secret), 'hex'))) {
      return reply.code(401).send({ error: 'Dispositivo não autorizado.' });
    }
    req.printDevice = row;
  };
  const event = (db, id, actor, state, detail = null) => db.query(
    'INSERT INTO central_print_events (job_id,actor,event,detail) VALUES (?,?,?,?)', [id, actor, state, detail]);
  const transaction = async fn => {
    const db = await pool.getConnection();
    try { await db.beginTransaction(); const result = await fn(db); await db.commit(); return result; }
    catch (error) { await db.rollback(); throw error; } finally { db.release(); }
  };
  app.get('/admin/printing/devices', { preHandler: admin }, async () => {
    const [rows] = await pool.query('SELECT id,name,enabled,allowed_printers,inventory,last_seen_at,(last_seen_at > DATE_SUB(NOW(),INTERVAL 60 SECOND)) AS online FROM central_print_devices ORDER BY created_at');
    return { devices: rows.map(r => ({ ...r, online: Boolean(r.enabled && r.online), allowed_printers: json(r.allowed_printers, []), inventory: json(r.inventory, []) })) };
  });
  app.post('/admin/printing/devices', { preHandler: admin }, async req => {
    const name = text(req.body?.name);
    const allowed = req.body?.printers;
    if (!Array.isArray(allowed) || !allowed.length || allowed.length > 20) throw problem('Selecione de 1 a 20 impressoras.');
    const printers = [...new Set(allowed.map(p => text(p)))];
    const id = crypto.randomUUID(); const secret = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO central_print_devices (id,name,secret_hash,allowed_printers,created_by) VALUES (?,?,?,?,?)',
      [id, name, hash(secret), JSON.stringify(printers), req.printActor]);
    return { id, name, token: `${id}.${secret}` };
  });
  app.delete('/admin/printing/devices/:id', { preHandler: admin }, async req => {
    await pool.query('UPDATE central_print_devices SET enabled=0 WHERE id=?', [req.params.id]);
    return { ok: true };
  });
  app.post('/printing/agent/heartbeat', { preHandler: device }, async req => {
    const inventory = normalizeInventory(req.body?.printers, json(req.printDevice.allowed_printers, []));
    await pool.query('UPDATE central_print_devices SET inventory=?,last_seen_at=NOW() WHERE id=? AND enabled=1',
      [JSON.stringify(inventory), req.printDevice.id]);
    return { ok: true, printers: inventory.map(p => p.name) };
  });
  app.get('/admin/printing/jobs', { preHandler: admin }, async () => {
    const [jobs] = await pool.query(`SELECT ${PUBLIC_JOB_FIELDS} FROM central_print_jobs ORDER BY created_at DESC LIMIT 100`);
    return { jobs };
  });
  app.get('/admin/printing/jobs/:id', { preHandler: admin }, async req => {
    const [rows] = await pool.query(`SELECT ${PUBLIC_JOB_FIELDS} FROM central_print_jobs WHERE id=?`, [req.params.id]);
    if (!rows[0]) throw problem('Trabalho não encontrado.', 404);
    const [events] = await pool.query('SELECT actor,event,detail,created_at FROM central_print_events WHERE job_id=? ORDER BY id', [req.params.id]);
    return { ...rows[0], events };
  });
  app.post('/admin/printing/jobs', { preHandler: admin, bodyLimit: 12 * 1024 * 1024 }, async req => {
    const body = req.body || {};
    if (!UUID.test(body.idempotencyKey || '') || !UUID.test(body.deviceId || '')) throw problem('Identificador inválido.');
    const printer = text(body.printerName); const title = text(body.title);
    const settings = body.settings || {};
    const serialized = JSON.stringify(settings);
    if (serialized.length > 16000) throw problem('Configuração muito grande.');
    const pdf = await validatePdf(body.pdfBase64, { widthMm: settings.widthMm, heightMm: settings.heightMm, pages: settings.pages });
    const fingerprint = hash(JSON.stringify([body.deviceId, printer, title, pdf.hash, serialized]));
    const [old] = await pool.query(`SELECT ${PUBLIC_JOB_FIELDS}, request_hash FROM central_print_jobs WHERE requested_by=? AND idempotency_key=?`,
      [req.printActor, body.idempotencyKey]);
    if (old[0]) {
      if (old[0].request_hash !== fingerprint) throw problem('Esta solicitação já foi usada para outro documento.', 409);
      const { request_hash, ...job } = old[0]; return job;
    }
    const [devices] = await pool.query('SELECT * FROM central_print_devices WHERE id=? AND enabled=1', [body.deviceId]);
    const dest = devices[0];
    if (!dest || !json(dest.allowed_printers, []).includes(printer)) throw problem('Destino não autorizado.');
    const capability = json(dest.inventory, []).find(p => p.name === printer);
    if (!capability || !matchPaper(capability, pdf.widthMm, pdf.heightMm)) throw problem('O driver do destino ainda não oferece esse tamanho de papel.');
    const id = crypto.randomUUID();
    try {
      await transaction(async db => {
        await db.query(`INSERT INTO central_print_jobs
          (id,device_id,printer_name,title,requested_by,idempotency_key,request_hash,pdf_hash,pdf_data,width_mm,height_mm,pages,settings_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, body.deviceId, printer, title, req.printActor, body.idempotencyKey,
          fingerprint, pdf.hash, pdf.buffer, pdf.widthMm, pdf.heightMm, pdf.pages, serialized]);
        await event(db, id, req.printActor, 'queued');
      });
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [existing] = await pool.query(`SELECT ${PUBLIC_JOB_FIELDS},request_hash FROM central_print_jobs WHERE requested_by=? AND idempotency_key=?`, [req.printActor, body.idempotencyKey]);
      if (!existing[0] || existing[0].request_hash !== fingerprint) throw problem('Solicitação conflitante.', 409);
      const { request_hash, ...job } = existing[0]; return job;
    }
    return { id, status: 'queued', pages: pdf.pages };
  });
  app.post('/admin/printing/jobs/:id/cancel', { preHandler: admin }, async req => transaction(async db => {
    const [result] = await db.query("UPDATE central_print_jobs SET status='cancelled' WHERE id=? AND status='queued'", [req.params.id]);
    if (!result.affectedRows) throw problem('Só é possível cancelar trabalhos aguardando envio.', 409);
    await event(db, req.params.id, req.printActor, 'cancelled'); return { ok: true };
  }));
  app.post('/admin/printing/jobs/:id/reprint', { preHandler: admin }, async req => transaction(async db => {
    const reason = text(req.body?.reason, 300);
    const key = req.body?.idempotencyKey;
    if (!UUID.test(key || '')) throw problem('Identificador inválido.');
    // Lock source: serializes retries with the same key before creating another physical copy.
    const [rows] = await db.query('SELECT * FROM central_print_jobs WHERE id=? FOR UPDATE', [req.params.id]);
    const old = rows[0];
    if (!old || !old.pdf_data) throw problem('PDF não disponível para reimpressão.', 410);
    const [existing] = await db.query('SELECT id,reprint_of FROM central_print_jobs WHERE requested_by=? AND idempotency_key=?', [req.printActor, key]);
    if (existing[0]) {
      if (existing[0].reprint_of !== old.id) throw problem('Solicitação conflitante.', 409);
      return { id: existing[0].id };
    }
    if (!['submitted', 'failed', 'uncertain', 'cancelled'].includes(old.status)) throw problem('Aguarde o resultado do trabalho original.', 409);
    const [dest] = await db.query('SELECT id FROM central_print_devices WHERE id=? AND enabled=1', [old.device_id]);
    if (!dest.length) throw problem('Dispositivo revogado.');
    const id = crypto.randomUUID();
    await db.query(`INSERT INTO central_print_jobs
      (id,device_id,printer_name,title,requested_by,idempotency_key,request_hash,pdf_hash,pdf_data,width_mm,height_mm,pages,settings_json,reprint_of)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, old.device_id, old.printer_name, old.title, req.printActor, key,
      hash(`${old.id}:${reason}`), old.pdf_hash, old.pdf_data, old.width_mm, old.height_mm, old.pages, old.settings_json, old.id]);
    await event(db, id, req.printActor, 'queued', `Reimpressão: ${reason}`);
    return { id, status: 'queued' };
  }));
  app.post('/printing/agent/claim', { preHandler: device }, async req => transaction(async db => {
    const deviceId = req.printDevice.id;
    // Device row lock works on MySQL versions without SKIP LOCKED. Transactions are short.
    const [devices] = await db.query('SELECT * FROM central_print_devices WHERE id=? AND enabled=1 FOR UPDATE', [deviceId]);
    if (!devices.length) throw problem('Dispositivo revogado.', 401);
    const printer = text(req.body?.printerName);
    const inventory = json(devices[0].inventory, []);
    if (!json(devices[0].allowed_printers, []).includes(printer)) throw problem('Impressora não autorizada.', 403);
    if (!inventory.some(p => p.name === printer && p.status !== 'offline')) return { job: null };
    const [expired] = await db.query("SELECT id,status FROM central_print_jobs WHERE device_id=? AND status IN ('reserved','sending') AND lease_until < NOW() FOR UPDATE", [deviceId]);
    for (const old of expired) {
      const status = old.status === 'sending' ? 'uncertain' : 'queued';
      await db.query('UPDATE central_print_jobs SET status=?,lease_until=NULL WHERE id=?', [status, old.id]);
      await event(db, old.id, deviceId, status, old.status === 'sending' ? 'Conexão perdida após iniciar envio; conferir antes de reimprimir.' : 'Reserva expirada antes do envio.');
    }
    const [active] = await db.query("SELECT id FROM central_print_jobs WHERE device_id=? AND printer_name=? AND status IN ('reserved','sending') LIMIT 1", [deviceId, printer]);
    if (active.length) return { job: null };
    const [jobs] = await db.query("SELECT id,printer_name,width_mm,height_mm,pages,pdf_hash FROM central_print_jobs WHERE device_id=? AND printer_name=? AND status='queued' ORDER BY created_at,id LIMIT 1 FOR UPDATE", [deviceId, printer]);
    if (!jobs[0]) return { job: null };
    const claimToken = crypto.randomUUID();
    await db.query("UPDATE central_print_jobs SET status='reserved',claim_token=?,lease_until=DATE_ADD(NOW(),INTERVAL 2 MINUTE),attempts=attempts+1 WHERE id=?", [claimToken, jobs[0].id]);
    await event(db, jobs[0].id, deviceId, 'reserved');
    return { job: { ...jobs[0], claimToken } };
  }));
  app.get('/printing/agent/jobs/:id/pdf', { preHandler: device }, async (req, reply) => {
    const [rows] = await pool.query("SELECT pdf_data FROM central_print_jobs WHERE id=? AND device_id=? AND claim_token=? AND status='reserved' AND lease_until>NOW()",
      [req.params.id, req.printDevice.id, req.headers['x-print-claim'] || '']);
    if (!rows[0]?.pdf_data) throw problem('Documento indisponível para esta reserva.', 409);
    return reply.header('Cache-Control', 'no-store').type('application/pdf').send(rows[0].pdf_data);
  });
  app.post('/printing/agent/jobs/:id/start', { preHandler: device }, async req => transaction(async db => {
    const [result] = await db.query("UPDATE central_print_jobs SET status='sending',lease_until=DATE_ADD(NOW(),INTERVAL 10 MINUTE) WHERE id=? AND device_id=? AND claim_token=? AND status='reserved' AND lease_until>NOW()",
      [req.params.id, req.printDevice.id, req.body?.claimToken || '']);
    if (!result.affectedRows) throw problem('Reserva expirada ou envio já iniciado.', 409);
    await event(db, req.params.id, req.printDevice.id, 'sending'); return { ok: true };
  }));
  app.post('/printing/agent/jobs/:id/result', { preHandler: device }, async req => transaction(async db => {
    const state = req.body?.status;
    if (!['submitted', 'failed', 'uncertain'].includes(state)) throw problem('Resultado inválido.');
    const [rows] = await db.query('SELECT status,claim_token FROM central_print_jobs WHERE id=? AND device_id=? FOR UPDATE', [req.params.id, req.printDevice.id]);
    const row = rows[0];
    if (!row || row.claim_token !== req.body?.claimToken) throw problem('Reserva inválida.', 409);
    if (row.status === state) return { ok: true };
    if (!(row.status === 'sending' || (row.status === 'reserved' && ['failed', 'uncertain'].includes(state)) ||
        (row.status === 'uncertain' && state === 'submitted'))) throw problem('Transição inválida.', 409);
    const message = String(req.body?.error || '').replace(/[\x00-\x1f]/g, ' ').slice(0, 500) || null;
    await db.query('UPDATE central_print_jobs SET status=?,lease_until=NULL,last_error=? WHERE id=?', [state, message, req.params.id]);
    await event(db, req.params.id, req.printDevice.id, state, message); return { ok: true };
  }));
  // Offline devices cannot report abandoned leases. Keep these visible without
  // ever requeuing an attempt that may already have reached the spooler.
  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await transaction(async db => {
        const [expired] = await db.query("SELECT id,status FROM central_print_jobs WHERE status IN ('reserved','sending') AND lease_until<NOW() LIMIT 100 FOR UPDATE");
        for (const old of expired) {
          const status = old.status === 'sending' ? 'uncertain' : 'queued';
          await db.query('UPDATE central_print_jobs SET status=?,lease_until=NULL WHERE id=?', [status, old.id]);
          await event(db, old.id, 'system', status, 'Reserva expirada. Envios iniciados exigem conferência.');
        }
        // Keep audit metadata. Uncertain documents remain available for review.
        await db.query("UPDATE central_print_jobs SET pdf_data=NULL,updated_at=updated_at WHERE status IN ('submitted','failed','cancelled') AND updated_at<DATE_SUB(NOW(),INTERVAL 30 DAY) AND pdf_data IS NOT NULL LIMIT 100");
      });
    } catch (error) { app.log.error({ code: error.code }, 'Falha na manutenção da fila central'); }
    finally { sweeping = false; }
  };
  const timer = setInterval(() => void sweep(), 60000);
  timer.unref();
  app.addHook('onClose', async () => { clearInterval(timer); });
}
module.exports = { registerCentralPrintingRoutes };
