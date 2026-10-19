'use strict';

const { isIP } = require('node:net');
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
// Deliberately exact hosts, never a caller-provided hostname or a wildcard Meta domain.
// Instagram observed in our verified webhooks; Messenger's attachment CDN is
// documented at https://help.webexconnect.io/docs/messenger (messenger.attachmentUrl).
const META_MEDIA_HOSTS = Object.freeze(['lookaside.fbsbx.com','scontent.xx.fbcdn.net']);
const reject = code => ({ ok: false, code });

function acceptedUrl(value) {
  if (typeof value !== 'string' || value.length > 16000 || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
      || isIP(url.hostname) || !META_MEDIA_HOSTS.includes(url.hostname)) return null;
    // URL.port normalizes an explicit :443 away; prohibit explicit ports as well.
    const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/, 1)[0];
    if (authority.includes(':')) return null;
    return url;
  } catch { return null; }
}

function detectedType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: 'image/png', fileExtension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { mimeType: 'image/jpeg', fileExtension: 'jpg' };
  }
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) {
    return { mimeType: 'image/webp', fileExtension: 'webp' };
  }
  return null;
}

// Invoke only after inbox eligibility, activation, handoff and PayJoy guards. This function has
// no scheduler, filesystem, persistent storage or upload path. Its result is transient binary
// staging input: the caller must convert data to n8n $binary before invoking the vision node.
function createMetaAttendanceMedia({ fetch: fetchImpl, timeoutMs = 15000 } = {}) {
  async function download({ event, attachment } = {}) {
    if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
      return reject('media_not_configured');
    }
    if (!event || !['instagram', 'messenger'].includes(event.channel) || event.surface !== 'dm'
      || event.status !== 'captured' || event.eventType !== 'message' || event.isEcho !== false
      || !Array.isArray(event.attachments) || attachment?.type !== 'image'
      || !event.attachments.some(item => item?.type === attachment.type && item.url === attachment.url
        && (item.providerId || null) === (attachment.providerId || null))) return reject('ineligible_media');
    const url = acceptedUrl(attachment.url);
    if (!url) return reject('media_url_not_allowed');
    const controller = new AbortController();
    let timedOut = false, reader, response, completed = false;
    let timer;
    const deadline = new Promise((_, rejectTimeout) => {
      timer = setTimeout(() => { timedOut = true; controller.abort(); rejectTimeout(new Error('deadline')); }, timeoutMs);
    });
    const bounded = promise => Promise.race([promise, deadline]);
    try {
      response = await bounded(fetchImpl(url.toString(), {
        method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Accept: 'image/png,image/jpeg,image/webp' }, signal: controller.signal,
      }));
      if (response.redirected || (response.status >= 300 && response.status < 400)) return reject('media_redirect_not_allowed');
      if (!response.ok) return reject([401, 403, 404, 410].includes(response.status) ? 'media_expired_or_unavailable' : 'media_download_failed');
      // A noncompliant injected fetch must not silently fetch another host.
      if (response.url && response.url !== url.toString()) return reject('media_redirect_not_allowed');
      const mime = String(response.headers?.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return reject('media_type_not_supported');
      const lengthHeader = response.headers?.get('content-length');
      if (lengthHeader != null && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_MEDIA_BYTES)) return reject('media_too_large');
      if (!response.body || typeof response.body.getReader !== 'function') return reject('media_stream_required');
      reader = response.body.getReader();
      let total = 0;
      const chunks = [];
      while (true) {
        const part = await bounded(reader.read());
        if (part.done) { completed = true; break; }
        if (!(part.value instanceof Uint8Array)) return reject('media_invalid_stream');
        total += part.value.byteLength;
        if (total > MAX_MEDIA_BYTES) return reject('media_too_large');
        if (part.value.byteLength) chunks.push(Buffer.from(part.value));
      }
      if (!total) return reject('media_empty');
      const bytes = Buffer.concat(chunks, total);
      const type = detectedType(bytes);
      if (!type || type.mimeType !== mime) return reject('media_signature_mismatch');
      return { ok: true, data: bytes.toString('base64'), mimeType: type.mimeType,
        fileExtension: type.fileExtension, fileName: `meta-payjoy-print.${type.fileExtension}`, byteLength: total };
    } catch { return reject(timedOut ? 'media_download_timeout' : 'media_download_failed'); }
    finally {
      clearTimeout(timer);
      if (!completed) {
        controller.abort();
        try {
          const cancel = reader ? reader.cancel() : response?.body?.cancel?.();
          if (cancel && typeof cancel.catch === 'function') cancel.catch(() => {});
        } catch {}
      }
      try { reader?.releaseLock(); } catch {}
    }
  }
  return { download };
}

module.exports = { createMetaAttendanceMedia, MAX_MEDIA_BYTES, META_MEDIA_HOSTS };
