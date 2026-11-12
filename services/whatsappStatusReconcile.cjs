'use strict';

// whatsapp-status-reconcile-v1
// Quando o WAHA não confirma um Status (HTTP 5xx, timeout, sem id), a entrega fica "incerta" e o
// envio automático é bloqueado para não publicar duas vezes. Este módulo confere no próprio WhatsApp
// (leitura de status@broadcast da mesma sessão) se o Status saiu:
//   - saiu        → marca a entrega como publicada (com o id encontrado);
//   - não saiu    → confirmado em 2 leituras seguidas → devolve para a fila (reenvio), até o limite;
//   - sem leitura → tenta de novo depois; desiste após a janela e deixa para conferência manual.

const FIRST_CHECK_DELAY_MS = 2 * 60 * 1000;
const RECHECK_DELAY_MS = 3 * 60 * 1000;
const GIVE_UP_AFTER_MS = 6 * 60 * 60 * 1000;
const NOT_FOUND_CONFIRMATIONS = 2;

function maxAttempts(env = process.env) {
  return Math.max(1, Math.min(10, Number(env.SOCIAL_STORY_WHATSAPP_MAX_ATTEMPTS || 3) || 3));
}

function wahaConfig(env = process.env) {
  return {
    baseUrl: String(env.WAHA_STATUS_SERVER_URL || 'http://127.0.0.1:18082').replace(/\/+$/, ''),
    apiKey: String(env.WAHA_STATUS_API_KEY || '').trim(),
    session: String(env.WAHA_STATUS_SESSION || '').trim(),
  };
}

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

function messageType(message) {
  const raw = String(message?._data?.type || message?.type || message?.media?.mimetype || message?.mimetype || '').toLowerCase();
  if (raw.startsWith('video') || raw === 'gif') return 'video';
  if (raw.startsWith('image')) return 'image';
  return '';
}

function messageTimestampMs(message) {
  const value = Number(message?.timestamp ?? message?.t ?? message?._data?.t);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 1e12 ? value * 1000 : value;
}

function messageId(message) {
  const id = message?.id;
  if (typeof id === 'string') return id;
  return id?._serialized || id?.id || message?.key?.id || null;
}

/** Procura, entre os Status da própria sessão, um de mesmo tipo/legenda publicado a partir de sinceMs. */
function findPublishedStatus(messages, { sinceMs, type, caption }) {
  const wanted = normalize(caption);
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message?.fromMe === false) continue;
    const at = messageTimestampMs(message);
    if (at === null || at < sinceMs - 60 * 1000) continue;
    const kind = messageType(message);
    if (kind && type && kind !== type) continue;
    const body = normalize(message?.body ?? message?.caption ?? message?._data?.caption);
    if (wanted && body !== wanted) continue;
    return { id: messageId(message), at };
  }
  return null;
}

/**
 * Confere no WhatsApp. Retorna { state: 'published'|'not_published'|'unknown', id?, reason }.
 * "Chat not found for status@broadcast" = a sessão não tem nenhum Status próprio → não publicado.
 */
async function verifyWahaStatusPublication({ sinceMs, type, caption, env = process.env, fetchImpl = fetch }) {
  const { baseUrl, apiKey, session } = wahaConfig(env);
  if (!apiKey || !session) return { state: 'unknown', reason: 'Configuração do WAHA ausente.' };
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/${encodeURIComponent(session)}/chats/status%40broadcast/messages?limit=50&downloadMedia=false`, {
      method: 'GET', headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { state: 'unknown', reason: 'Leitura dos Status sem resposta.' };
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = String(body?.exception?.message || body?.message || '');
    if (response.status === 500 && /^Chat not found for status@broadcast(?:\n|$)/.test(message)) {
      return { state: 'not_published', reason: 'Nenhum Status publicado nesta sessão.' };
    }
    return { state: 'unknown', reason: `Leitura dos Status falhou (HTTP ${response.status}).` };
  }
  const messages = await response.json().catch(() => null);
  if (!Array.isArray(messages)) return { state: 'unknown', reason: 'Resposta inesperada na leitura dos Status.' };
  const found = findPublishedStatus(messages, { sinceMs, type, caption });
  return found
    ? { state: 'published', id: found.id, reason: 'Status encontrado no WhatsApp.' }
    : { state: 'not_published', reason: 'Status não encontrado no WhatsApp.' };
}

let schemaPromise = null;
function ensureStatusCheckSchema(pool) {
  schemaPromise ||= pool.query(`CREATE TABLE IF NOT EXISTS social_story_delivery_checks (
      delivery_id CHAR(36) NOT NULL PRIMARY KEY,
      sent_at DATETIME(3) NOT NULL,
      state ENUM('waiting','published','retried','gave_up','unknown') NOT NULL DEFAULT 'waiting',
      checks INT UNSIGNED NOT NULL DEFAULT 0,
      not_found_streak INT UNSIGNED NOT NULL DEFAULT 0,
      last_check_at DATETIME(3) NULL,
      last_result VARCHAR(500) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_story_check_state (state, last_check_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

/** Registra uma entrega do WhatsApp com resultado incerto para conferência automática. */
async function registerUncertainWhatsAppDelivery(pool, deliveryId, sentAtMs) {
  await ensureStatusCheckSchema(pool);
  await pool.query(
    `INSERT INTO social_story_delivery_checks (delivery_id,sent_at,state,checks,not_found_streak,last_check_at,last_result)
     VALUES (?,?,'waiting',0,0,NULL,'Aguardando conferência no WhatsApp.')
     ON DUPLICATE KEY UPDATE sent_at=VALUES(sent_at),state='waiting',not_found_streak=0,last_check_at=NULL,last_result=VALUES(last_result)`,
    [deliveryId, new Date(sentAtMs)],
  );
}

async function loadDelivery(pool, deliveryId) {
  const [[row]] = await pool.query(
    `SELECT d.id,d.schedule_id,d.status,d.destination,d.attempt_count,i.media_type,i.caption,i.scheduled_at
     FROM social_story_deliveries d JOIN social_story_items i ON i.id=d.item_id WHERE d.id=?`, [deliveryId],
  );
  return row || null;
}

async function setCheck(pool, deliveryId, values) {
  await pool.query(
    `UPDATE social_story_delivery_checks SET state=?,checks=checks+1,not_found_streak=?,last_check_at=NOW(3),last_result=? WHERE delivery_id=?`,
    [values.state, values.streak || 0, String(values.result || '').slice(0, 500), deliveryId],
  );
}

async function markPublished(pool, delivery, id) {
  await pool.query(
    `UPDATE social_story_deliveries SET status='published',provider_publication_id=COALESCE(?,provider_publication_id),
       last_error=NULL,published_at=COALESCE(published_at,NOW()) WHERE id=? AND status='failed'`,
    [id || null, delivery.id],
  );
}

async function queueRetry(pool, delivery, env) {
  const limit = maxAttempts(env);
  if (Number(delivery.attempt_count || 0) >= limit) return false;
  await pool.query(
    `UPDATE social_story_deliveries SET status='pending',claimed_at=NULL,last_error=? WHERE id=? AND status='failed'`,
    [`Conferido no WhatsApp: o Status não foi publicado. Reenvio automático (tentativa ${Number(delivery.attempt_count || 0) + 1} de ${limit}).`, delivery.id],
  );
  await pool.query("UPDATE social_story_schedules SET status='processing' WHERE id=? AND status IN ('failed','partial','completed')", [delivery.schedule_id]);
  return true;
}

/**
 * Confere uma entrega. force=true (botão do admin) ignora a espera e a confirmação dupla.
 * Retorna { state, message } para a tela.
 */
async function checkWhatsAppDelivery(pool, deliveryId, { force = false, env = process.env, fetchImpl = fetch, now = Date.now, refreshSchedule } = {}) {
  await ensureStatusCheckSchema(pool);
  const delivery = await loadDelivery(pool, deliveryId);
  if (!delivery || delivery.destination !== 'whatsapp') return { state: 'invalid', message: 'Entrega do WhatsApp não encontrada.' };
  if (delivery.status === 'published') return { state: 'published', message: 'Já está como publicado.' };
  if (delivery.status !== 'failed') return { state: 'busy', message: 'Essa entrega ainda está na fila ou sendo enviada.' };
  const [[check]] = await pool.query('SELECT * FROM social_story_delivery_checks WHERE delivery_id=?', [deliveryId]);
  if (!check) {
    // falha antiga sem registro (ex.: antes desta versão): usa o horário agendado como referência
    await registerUncertainWhatsAppDelivery(pool, deliveryId, new Date(delivery.scheduled_at).getTime() || now());
  }
  const [[current]] = await pool.query('SELECT * FROM social_story_delivery_checks WHERE delivery_id=?', [deliveryId]);
  const sinceMs = new Date(current.sent_at).getTime();
  const result = await verifyWahaStatusPublication({ sinceMs, type: delivery.media_type, caption: delivery.caption || '', env, fetchImpl });

  let outcome;
  if (result.state === 'published') {
    await markPublished(pool, delivery, result.id);
    await setCheck(pool, deliveryId, { state: 'published', result: result.reason });
    outcome = { state: 'published', message: 'Conferido: o Status foi publicado. Entrega marcada como publicada.' };
  } else if (result.state === 'not_published') {
    const streak = Number(current.not_found_streak || 0) + 1;
    if (!force && streak < NOT_FOUND_CONFIRMATIONS) {
      await setCheck(pool, deliveryId, { state: 'waiting', streak, result: `${result.reason} Conferindo de novo antes de reenviar.` });
      outcome = { state: 'waiting', message: 'Não encontrado ainda; vai conferir de novo antes de reenviar.' };
    } else if (await queueRetry(pool, delivery, env)) {
      await setCheck(pool, deliveryId, { state: 'retried', streak, result: `${result.reason} Reenvio colocado na fila.` });
      outcome = { state: 'retried', message: 'Conferido: não foi publicado. Reenvio colocado na fila.' };
    } else {
      await setCheck(pool, deliveryId, { state: 'gave_up', streak, result: `${result.reason} Limite de tentativas atingido.` });
      await pool.query('UPDATE social_story_deliveries SET last_error=? WHERE id=?',
        [`Conferido no WhatsApp: o Status não foi publicado e o limite de ${maxAttempts(env)} tentativas foi atingido. Verifique o WAHA antes de reenviar.`, deliveryId]);
      outcome = { state: 'gave_up', message: 'Não foi publicado e o limite de tentativas foi atingido.' };
    }
  } else {
    const expired = now() - sinceMs > GIVE_UP_AFTER_MS;
    await setCheck(pool, deliveryId, { state: expired && !force ? 'unknown' : 'waiting', result: result.reason });
    if (expired && !force) {
      await pool.query('UPDATE social_story_deliveries SET last_error=? WHERE id=?',
        ['Não foi possível conferir no WhatsApp se o Status saiu. Confira no celular antes de reenviar.', deliveryId]);
    }
    outcome = { state: 'unknown', message: `Não deu para conferir agora: ${result.reason}` };
  }
  if (refreshSchedule) await refreshSchedule(pool, delivery.schedule_id);
  return outcome;
}

/** Roda a cada ciclo do agendador: confere até 3 entregas incertas que já passaram da espera. */
async function reconcileWhatsAppStoryDeliveries(pool, options = {}) {
  await ensureStatusCheckSchema(pool);
  const [rows] = await pool.query(
    `SELECT c.delivery_id FROM social_story_delivery_checks c
     JOIN social_story_deliveries d ON d.id=c.delivery_id
     WHERE c.state='waiting' AND d.status='failed'
       AND c.sent_at<=DATE_SUB(NOW(3),INTERVAL ? SECOND)
       AND (c.last_check_at IS NULL OR c.last_check_at<=DATE_SUB(NOW(3),INTERVAL ? SECOND))
     ORDER BY c.sent_at ASC LIMIT 3`,
    [Math.round(FIRST_CHECK_DELAY_MS / 1000), Math.round(RECHECK_DELAY_MS / 1000)],
  );
  const results = [];
  for (const row of rows) results.push(await checkWhatsAppDelivery(pool, row.delivery_id, options));
  return results;
}

async function checksByDeliveryIds(pool, ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return new Map();
  await ensureStatusCheckSchema(pool);
  const [rows] = await pool.query(
    `SELECT delivery_id,state,checks,last_check_at,last_result FROM social_story_delivery_checks WHERE delivery_id IN (${list.map(() => '?').join(',')})`, list,
  );
  return new Map(rows.map((row) => [row.delivery_id, row]));
}

module.exports = {
  FIRST_CHECK_DELAY_MS,
  NOT_FOUND_CONFIRMATIONS,
  findPublishedStatus,
  verifyWahaStatusPublication,
  ensureStatusCheckSchema,
  registerUncertainWhatsAppDelivery,
  checkWhatsAppDelivery,
  reconcileWhatsAppStoryDeliveries,
  checksByDeliveryIds,
  maxAttempts,
};
