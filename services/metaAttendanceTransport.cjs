'use strict';

const { createHash, createHmac, createDecipheriv } = require('node:crypto');
const WINDOW_MS = 24 * 60 * 60 * 1000;
const validId = value => typeof value === 'string' && /^[\x21-\x7e]{1,255}$/.test(value);
const failure = (status, code, httpStatus) => ({ ok: false, status, code, retryable: false,
  ...(Number.isInteger(httpStatus) ? { httpStatus } : {}) });

function decrypt(row, secret) {
  const iv = Buffer.from(row.token_iv || '', 'base64');
  const tag = Buffer.from(row.token_auth_tag || '', 'base64');
  if (iv.length !== 12 || tag.length !== 16 || !row.token_ciphertext || !secret) throw new Error('invalid_credentials');
  const key = createHash('sha256').update(secret).digest();
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(Buffer.from(row.token_ciphertext, 'base64')), cipher.final()]).toString('utf8');
}

function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 8000) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    // Reject encoded separators/traversal that the image server could decode differently.
    let path = url.pathname;
    for (let i = 0; i < 4; i++) {
      if (/[\\]/.test(path) || path.split('/').some(part => part === '..' || part === '.')) return false;
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      if (/%(?:2f|5c)/i.test(path)) return false;
      path = decoded;
      if (i === 3) return false;
    }
    return url.hostname === 'imagens.xiaomipetrolina.com.br'
      || (url.hostname === 'api.xiaomipetrolina.com.br' && url.pathname.startsWith('/images/'));
  } catch { return false; }
}

function date(value) {
  return typeof value === 'string' && value.length <= 40 ? Date.parse(value) : NaN;
}

// No queue, replay or retries here. The caller owns a durable unique outbox and activation cursor.
// send accepts a trusted captured inbound event, never a recipient chosen by the response engine.
// Optional receivedAt/activationAt are supplied by the inbox/worker, not the customer or LLM.
function createMetaAttendanceTransport({ fetch: fetchImpl, graphVersion, appId, appSecret, encryptionKey, loadConnection, now = Date.now } = {}) {
  async function send({ event, message } = {}) {
    if (typeof fetchImpl !== 'function' || typeof loadConnection !== 'function'
      || !/^v\d+\.\d+$/.test(graphVersion || '')
      || ![appId, appSecret, encryptionKey].every(value => typeof value === 'string' && value.length > 0)) {
      return failure('rejected', 'transport_not_configured');
    }
    if (!event || !['instagram', 'messenger'].includes(event.channel) || event.surface !== 'dm'
      || event.eventType !== 'message' || event.status !== 'captured' || event.isEcho !== false
      || !validId(event.accountId) || !validId(event.participantId) || !validId(event.providerEventId)
      || event.isReplay === true || event.replayed === true) return failure('rejected', 'ineligible_event');
    const currentTime = Number(now());
    const occurredAt = date(event.occurredAt);
    if (!Number.isFinite(currentTime) || !Number.isFinite(occurredAt) || occurredAt > currentTime
      || currentTime - occurredAt >= WINDOW_MS) return failure('rejected', 'messaging_window_closed');
    if (event.receivedAt !== undefined) {
      const receivedAt = date(event.receivedAt);
      if (!Number.isFinite(receivedAt) || receivedAt > currentTime || currentTime - receivedAt >= WINDOW_MS) {
        return failure('rejected', 'ineligible_received_at');
      }
    }
    if (event.activationAt !== undefined) {
      const activationAt = date(event.activationAt), receivedAt = date(event.receivedAt);
      if (!Number.isFinite(activationAt) || !Number.isFinite(receivedAt) || receivedAt < activationAt || occurredAt < activationAt) {
        return failure('rejected', 'historical_event');
      }
    }
    let outgoing;
    if (message?.type === 'text' && typeof message.text === 'string' && message.text.trim() && [...message.text].length <= 900) {
      outgoing = { text: message.text };
    } else if (message?.type === 'image' && imageUrl(message.url)) {
      outgoing = { attachment: { type: 'image', payload: { url: message.url } } };
    } else return failure('rejected', 'invalid_message');

    let row, userToken;
    try { row = await loadConnection(); userToken = decrypt(row || {}, encryptionKey); }
    catch { return failure('failed', 'connection_credentials_unavailable'); }
    if (!userToken || !validId(row.selected_page_id)
      || event.accountId !== (event.channel === 'messenger' ? row.selected_page_id : row.selected_instagram_account_id)) {
      return failure('rejected', 'asset_mismatch');
    }
    const base = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(row.selected_page_id)}`;
    const proof = createHmac('sha256', appSecret).update(userToken).digest('hex');
    let resolved, response;
    try {
      const url = new URL(base);
      url.searchParams.set('fields', 'access_token,instagram_business_account');
      url.searchParams.set('appsecret_proof', proof);
      response = await fetchImpl(url.toString(), {
        method: 'GET', headers: { Authorization: `Bearer ${userToken}` },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return failure('failed', response.status === 429 ? 'meta_rate_limited' : 'page_token_unavailable', response.status);
      resolved = await response.json();
    } catch { return failure('failed', 'page_token_unavailable'); }
    if (resolved?.error || typeof resolved?.access_token !== 'string' || !resolved.access_token
      || (resolved.id !== undefined && resolved.id !== row.selected_page_id)) return failure('failed', 'page_token_unavailable');
    if (event.channel === 'instagram' && resolved.instagram_business_account?.id !== event.accountId) {
      return failure('rejected', 'instagram_link_mismatch');
    }
    // Resolve first, then recheck the clock: lookup latency must not extend the allowed window.
    const sendTime = Number(now());
    if (!Number.isFinite(sendTime) || sendTime < occurredAt || sendTime - occurredAt >= WINDOW_MS) {
      return failure('rejected', 'messaging_window_closed');
    }
    const pageToken = resolved.access_token;
    const body = {
      recipient: { id: event.participantId }, message: outgoing,
      ...(event.channel === 'messenger' ? { messaging_type: 'RESPONSE' } : {}),
      appsecret_proof: createHmac('sha256', appSecret).update(pageToken).digest('hex'),
    };
    let result;
    try {
      response = await fetchImpl(`${base}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      if (response.status >= 500) return failure('result_unknown', 'meta_send_result_unknown', response.status);
      if (!response.ok) return failure('failed', response.status === 429 ? 'meta_rate_limited' : 'meta_send_rejected', response.status);
      result = await response.json();
    } catch { return failure('result_unknown', 'meta_send_result_unknown'); }
    if (result?.error || !validId(result?.message_id)
      || (result.recipient_id !== undefined && result.recipient_id !== event.participantId)) {
      return failure('result_unknown', 'meta_send_result_unknown');
    }
    return { ok: true, status: 'sent', providerMessageId: result.message_id, channel: event.channel };
  }
  return { send };
}

module.exports = { createMetaAttendanceTransport };
