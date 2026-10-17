'use strict';

const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const WEBHOOK_PATH = '/integrations/meta/attendance/webhook';
const MAX_EVENTS = 500;
const hash = value => createHash('sha256').update(value).digest('hex');

function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifySignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !appSecret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return sameSecret(signature, `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`);
}

function id(value) {
  return typeof value === 'string' && /^[\x21-\x7e]{1,255}$/.test(value) ? value : null;
}

function eventTime(value) {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : (/^\d+$/.test(String(value)) ? Number(value) : null);
  const ms = numeric == null ? Date.parse(value) : (numeric < 1e12 ? numeric * 1000 : numeric);
  return Number.isFinite(ms) && ms >= 0 && ms <= 253402300799999 ? new Date(ms).toISOString() : null;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

function conversationKey(channel, accountId, participantId, surface, threadId = '') {
  if (!['instagram', 'messenger'].includes(channel) || !id(accountId) || !id(participantId)) return null;
  if (surface === 'comment' && !id(threadId)) return null;
  return [channel, accountId, participantId, surface, ...(surface === 'comment' ? [threadId] : [])].map(encodeURIComponent).join(':');
}

function mediaAttachments(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(v => v && typeof v === 'object').map(v => {
    const rawUrl = v.payload?.url;
    let url = null;
    try { const parsed = new URL(rawUrl); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && rawUrl.length <= 8000) url = rawUrl; } catch {}
    return { type: typeof v.type === 'string' ? v.type.slice(0, 80) : 'unknown', url, providerId: id(v.payload?.attachment_id) };
  });
}

// Only the selected business assets may enter this inbox. IDs are never telephone numbers.
function normalizeEnvelope(body, assets) {
  if (!body || !['page', 'instagram'].includes(body.object) || !Array.isArray(body.entry)) {
    throw Object.assign(new Error('unsupported_envelope'), { statusCode: 400 });
  }
  const channel = body.object === 'instagram' ? 'instagram' : 'messenger';
  const expected = channel === 'instagram' ? assets.instagramAccountId : assets.pageId;
  const events = [];
  let foreignEntries = 0;
  const add = event => {
    if (events.length >= MAX_EVENTS) throw Object.assign(new Error('too_many_events'), { statusCode: 413 });
    events.push(event);
  };
  for (const entry of body.entry) {
    if (!expected || !id(entry?.id) || entry.id !== expected) { foreignEntries++; continue; }
    const accountId = entry.id;
    const make = (raw, data) => {
      const providerEventId = id(data.providerEventId);
      const dedupIdentity = providerEventId
        ? [data.eventType, providerEventId, data.action || '', ...(data.surface === 'comment' ? [hash(stableJson(raw))] : [])]
        : [data.eventType || 'unsupported', hash(stableJson(raw))];
      const event = {
        schemaVersion: 1, channel, accountId, participantId: null, surface: 'other',
        eventType: 'unsupported', action: null, text: '', attachments: [], occurredAt: eventTime(entry.time),
        postId: null, parentCommentId: null, adId: null, isEcho: false, status: 'unsupported', ...data,
        providerEventId,
      };
      event.conversationKey = conversationKey(channel, accountId, event.participantId, event.surface, event.parentCommentId || event.providerEventId);
      event.eventKey = hash(stableJson([channel, accountId, ...dedupIdentity]));
      add(event);
    };
    for (const message of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const m = message?.message;
      const isEcho = m?.is_echo === true || message?.sender?.id === accountId;
      const participantId = id(isEcho ? message?.recipient?.id : message?.sender?.id);
      const occurredAt = eventTime(message?.timestamp ?? entry.time);
      if (m && typeof m === 'object') {
        const providerEventId = id(m.mid);
        const targetMatches = isEcho ? message.sender?.id === accountId : message.recipient?.id === accountId;
        const status = isEcho && targetMatches ? 'ignored' : (targetMatches && participantId && providerEventId ? 'captured' : 'unsupported');
        make(message, {
          participantId, providerEventId, occurredAt, surface: 'dm', isEcho, status,
          eventType: isEcho ? 'message_echo' : 'message', text: typeof m.text === 'string' ? m.text : '',
          attachments: mediaAttachments(m.attachments), adId: id(message.referral?.ad_id || m.referral?.ad_id),
        });
      } else {
        const eventType = message?.read ? 'read' : message?.delivery ? 'delivery' : 'unsupported';
        make(message, { participantId, occurredAt, eventType, status: eventType === 'unsupported' ? 'unsupported' : 'ignored' });
      }
    }
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const isComment = (channel === 'instagram' && change?.field === 'comments')
        || (channel === 'messenger' && change?.field === 'feed' && value.item === 'comment');
      if (!isComment) { make(change, {}); continue; }
      const providerEventId = id(channel === 'instagram' ? value.id : value.comment_id);
      const participantId = id(value.from?.id);
      const action = typeof value.verb === 'string' ? value.verb : 'add';
      const isEcho = participantId === accountId;
      make(change, {
        participantId, providerEventId, surface: 'comment', eventType: 'comment', action, isEcho,
        status: isEcho || action !== 'add' ? 'ignored' : (participantId && providerEventId ? 'captured' : 'unsupported'),
        text: typeof value.text === 'string' ? value.text : (typeof value.message === 'string' ? value.message : ''),
        occurredAt: eventTime(value.created_time ?? value.timestamp ?? entry.time),
        postId: id(value.media?.id || value.post_id), parentCommentId: id(value.parent_id),
      });
    }
  }
  return { events, foreignEntries };
}

module.exports = { WEBHOOK_PATH, MAX_EVENTS, sameSecret, verifySignature, normalizeEnvelope, conversationKey };
