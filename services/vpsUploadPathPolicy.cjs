const path = require('path');

const ALLOWED_MEDIA_UPLOAD_PREFIXES = [
  'products/',
  'model-color/',
  'company/',
  'legacy/',
  'banners/',
];

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

function validateMediaUploadPath(rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) return { ok: false, error: 'path required' };
  if (/^[a-zA-Z]:[\\/]/.test(value)) return { ok: false, error: 'absolute paths are not allowed' };
  if (value.includes('\\')) return { ok: false, error: 'backslashes are not allowed' };

  const safePath = path.posix.normalize(value).replace(/^\/+/, '');
  if (!safePath || safePath === '.' || safePath.startsWith('../') || safePath.includes('/../')) {
    return { ok: false, error: 'path traversal is not allowed' };
  }

  if (!ALLOWED_MEDIA_UPLOAD_PREFIXES.some((prefix) => safePath.startsWith(prefix))) {
    return { ok: false, error: 'unsupported media upload prefix' };
  }

  const ext = path.posix.extname(safePath).toLowerCase();
  if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
    return { ok: false, error: 'unsupported media extension' };
  }

  return { ok: true, safePath };
}

module.exports = {
  ALLOWED_MEDIA_UPLOAD_PREFIXES,
  ALLOWED_MEDIA_EXTENSIONS,
  validateMediaUploadPath,
};
