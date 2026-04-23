const DEFAULT_VIDEO_CDN_BASE_URL = 'https://videos.mercadodovale.com.br';

function cleanVideoSku(sku) {
  return String(sku || '').trim().replace(/\s+/g, '');
}

function cleanVideoExtension(extension) {
  const clean = String(extension || '.mp4').trim();
  if (!clean) return '.mp4';
  return clean.startsWith('.') ? clean : `.${clean}`;
}

function buildVideoFileName(sku, extension) {
  return `${cleanVideoSku(sku)}${cleanVideoExtension(extension)}`;
}

function comparableFileName(fileName) {
  return String(fileName || '').normalize('NFC').toLowerCase();
}

function fileNameFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.name === 'string') return entry.name;
  return '';
}

function findCaseInsensitiveVideoFileName(files, requestedFileName) {
  const requested = comparableFileName(requestedFileName);
  if (!requested || !Array.isArray(files)) return null;

  for (const entry of files) {
    const actualName = fileNameFromEntry(entry);
    if (actualName && comparableFileName(actualName) === requested) {
      return actualName;
    }
  }

  return null;
}

function buildVideoCdnUrl(fileName, baseUrl = DEFAULT_VIDEO_CDN_BASE_URL) {
  const normalizedBaseUrl = String(baseUrl || DEFAULT_VIDEO_CDN_BASE_URL).trim().replace(/\/+$/, '');
  return `${normalizedBaseUrl}/${encodeURIComponent(fileName)}`;
}

module.exports = {
  DEFAULT_VIDEO_CDN_BASE_URL,
  buildVideoCdnUrl,
  buildVideoFileName,
  cleanVideoExtension,
  cleanVideoSku,
  findCaseInsensitiveVideoFileName,
};
