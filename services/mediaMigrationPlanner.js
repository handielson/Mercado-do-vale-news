import crypto from 'node:crypto';

const DEFAULT_VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const HASH_PREFIX_LENGTH = 16;

const MIME_EXTENSIONS = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function safeSegment(value, fallback = 'unknown') {
  const text = String(value || '').trim();
  const safe = text.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || fallback;
}

function fieldSegment(field) {
  return safeSegment(String(field || 'image').replace(/\[[0-9]+\]/g, ''));
}

export function decodeInlineDataImage(dataUrl) {
  const match = /^data:([^;,]+);base64,(.*)$/u.exec(String(dataUrl || ''));
  if (!match) return { ok: false, reason: 'inline data URL is not base64' };

  const mimeType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS.get(mimeType);
  if (!extension) return { ok: false, reason: `inline data MIME is not a supported raster image: ${mimeType}` };

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return { ok: false, reason: 'inline data base64 could not be decoded' };
  }

  if (buffer.length === 0) return { ok: false, reason: 'inline data image is empty' };

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    ok: true,
    buffer,
    mimeType,
    extension,
    byteLength: buffer.length,
    sha256,
  };
}

export function plannedPathForRef(ref, imageInfo) {
  const hash = imageInfo.sha256.slice(0, HASH_PREFIX_LENGTH);
  const ext = imageInfo.extension;
  const entityId = safeSegment(ref.entityId);

  if (ref.entityType === 'model_color_images') {
    return `model-color/${entityId}/${hash}.${ext}`;
  }

  if (ref.entityType === 'company_settings') {
    return `company/${entityId}/${fieldSegment(ref.field)}-${hash}.${ext}`;
  }

  if (ref.entityType === 'catalog_banner') {
    return `banners/migrated/${entityId}/${fieldSegment(ref.field)}-${hash}.${ext}`;
  }

  return `products/migrated/${entityId}/${hash}.${ext}`;
}

export function canonicalPayloadPath(imageInfo) {
  const hash = imageInfo.sha256.slice(0, HASH_PREFIX_LENGTH);
  return `legacy/inline/${hash}.${imageInfo.extension}`;
}

function plannedUrlForPath(path, vpsBaseUrl) {
  return `${String(vpsBaseUrl).replace(/\/+$/u, '')}/images/${path}`;
}

function scopeMatches(ref, scope) {
  if (scope === 'all-candidates') return Boolean(ref.shouldMigrate);
  if (scope === 'inline-data') return ref.origin === 'inline-data' && ref.shouldMigrate;
  if (scope === 'external') return ref.origin !== 'inline-data' && ref.shouldMigrate;
  return false;
}

export function buildMediaMigrationPlan(report, options = {}) {
  const scope = options.scope || 'inline-data';
  const vpsBaseUrl = options.vpsBaseUrl || DEFAULT_VPS_BASE_URL;
  const includeUploadPayloads = Boolean(options.includeUploadPayloads);
  const refs = Array.isArray(report?.refs) ? report.refs : [];
  const actions = [];
  const uniquePayloadHashes = new Set();

  for (const ref of refs) {
    if (!scopeMatches(ref, scope)) continue;

    if (ref.origin !== 'inline-data') {
      actions.push({
        mode: 'dry-run',
        status: 'blocked',
        reason: 'external download planning is reserved for the next batch',
        entityType: ref.entityType,
        entityId: ref.entityId,
        field: ref.field,
        origin: ref.origin,
        redactedUrl: ref.redactedUrl,
      });
      continue;
    }

    const decoded = decodeInlineDataImage(ref.url || ref.normalizedUrl || ref.sourceUrl);
    if (!decoded.ok) {
      actions.push({
        mode: 'dry-run',
        status: 'blocked',
        reason: decoded.reason,
        entityType: ref.entityType,
        entityId: ref.entityId,
        field: ref.field,
        origin: ref.origin,
        redactedUrl: ref.redactedUrl,
      });
      continue;
    }

    const plannedPath = canonicalPayloadPath(decoded);
    const duplicateOf = uniquePayloadHashes.has(decoded.sha256)
      ? plannedUrlForPath(plannedPath, vpsBaseUrl)
      : null;
    uniquePayloadHashes.add(decoded.sha256);
    const action = {
      mode: 'dry-run',
      status: 'planned',
      reason: 'inline data image can be uploaded to VPS before URL replacement',
      entityType: ref.entityType,
      entityId: ref.entityId,
      field: ref.field,
      origin: ref.origin,
      redactedUrl: ref.redactedUrl || 'data:REDACTED',
      mimeType: decoded.mimeType,
      byteLength: decoded.byteLength,
      sha256: decoded.sha256,
      plannedPath,
      plannedUrl: plannedUrlForPath(plannedPath, vpsBaseUrl),
      duplicateOf,
    };

    if (includeUploadPayloads) {
      action.uploadPayloadBase64 = decoded.buffer.toString('base64');
      action.uploadContentType = decoded.mimeType;
    }

    actions.push(action);
  }

  const planned = actions.filter((action) => action.status === 'planned').length;
  const blocked = actions.filter((action) => action.status === 'blocked').length;

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scope,
    summary: {
      totalCandidates: actions.length,
      planned,
      blocked,
      uniquePayloads: uniquePayloadHashes.size,
      plannedBytes: actions.reduce((sum, action) => sum + (action.byteLength || 0), 0),
    },
    actions,
  };
}
