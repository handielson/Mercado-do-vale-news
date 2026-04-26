const VPS_HOSTNAMES = new Set([
  'api.xiaomipetrolina.com.br',
]);

const SYNOLOGY_IMAGE_HOSTNAMES = new Set([
  'imagens.xiaomipetrolina.com.br',
]);

const SUPABASE_HOST_SUFFIX = '.supabase.co';
const IMGUR_HOSTNAMES = new Set(['i.imgur.com', 'imgur.com']);
const BLING_S3_HOSTNAMES = new Set(['orgbling.s3.amazonaws.com']);

const SENSITIVE_QUERY_KEYS = new Set([
  'AWSAccessKeyId',
  'Signature',
  'X-Amz-Credential',
  'X-Amz-Signature',
  'token',
  'access_token',
  'apikey',
  'key',
]);

function normalizeRawUrl(rawUrl) {
  if (rawUrl === null || rawUrl === undefined) return '';
  return String(rawUrl).trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isVpsPathname(pathname) {
  return pathname.startsWith('/images/') || pathname.startsWith('/banners/');
}

function classifyParsedHttpUrl(parsed, normalizedUrl, sourceUrl = normalizedUrl) {
  if (VPS_HOSTNAMES.has(parsed.hostname) && isVpsPathname(parsed.pathname)) {
    return {
      origin: 'vps',
      normalizedUrl,
      sourceUrl,
      redactedUrl: redactMediaUrl(sourceUrl),
      shouldMigrate: false,
      reason: 'Already served from canonical VPS image paths',
    };
  }

  if (parsed.hostname.endsWith(SUPABASE_HOST_SUFFIX) && parsed.pathname.includes('/storage/v1/object/')) {
    return {
      origin: 'supabase-storage',
      normalizedUrl,
      sourceUrl,
      redactedUrl: redactMediaUrl(sourceUrl),
      shouldMigrate: true,
      reason: 'Supabase Storage image should be copied to VPS',
    };
  }

  if (SYNOLOGY_IMAGE_HOSTNAMES.has(parsed.hostname)) {
    return {
      origin: 'synology-legacy',
      normalizedUrl,
      sourceUrl,
      redactedUrl: redactMediaUrl(sourceUrl),
      shouldMigrate: true,
      reason: 'Synology image hostname is legacy/backup, not public canonical media',
    };
  }

  if (IMGUR_HOSTNAMES.has(parsed.hostname)) {
    return {
      origin: 'imgur',
      normalizedUrl,
      sourceUrl,
      redactedUrl: redactMediaUrl(sourceUrl),
      shouldMigrate: true,
      reason: 'Imgur image should be copied to VPS',
    };
  }

  if (BLING_S3_HOSTNAMES.has(parsed.hostname)) {
    return {
      origin: 'bling-s3',
      normalizedUrl,
      sourceUrl,
      redactedUrl: redactMediaUrl(sourceUrl),
      shouldMigrate: true,
      reason: 'Bling S3 image should be ingested into VPS media',
    };
  }

  return {
    origin: 'external',
    normalizedUrl,
    sourceUrl,
    redactedUrl: redactMediaUrl(sourceUrl),
    shouldMigrate: true,
    reason: 'External image should be reviewed and copied to VPS when used publicly',
  };
}

export function redactMediaUrl(rawUrl) {
  const value = normalizeRawUrl(rawUrl);
  if (!value || !isHttpUrl(value)) return value;

  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key)) {
        parsed.searchParams.set(key, 'REDACTED');
      }
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

export function isCanonicalVpsImageUrl(rawUrl) {
  const value = normalizeRawUrl(rawUrl);
  if (!isHttpUrl(value)) return false;

  try {
    const parsed = new URL(value);
    return VPS_HOSTNAMES.has(parsed.hostname) && isVpsPathname(parsed.pathname);
  } catch {
    return false;
  }
}

export function classifyMediaUrl(rawUrl) {
  const normalizedUrl = normalizeRawUrl(rawUrl);

  if (!normalizedUrl) {
    return {
      origin: 'empty',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: normalizedUrl,
      shouldMigrate: false,
      reason: 'Empty media value',
    };
  }

  if (normalizedUrl.startsWith('data:')) {
    return {
      origin: 'inline-data',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: 'data:REDACTED',
      shouldMigrate: true,
      reason: 'Inline data image should be decoded and copied to VPS when stored in data rows',
    };
  }

  if (normalizedUrl.startsWith('blob:')) {
    return {
      origin: 'browser-blob',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: normalizedUrl,
      shouldMigrate: false,
      reason: 'Browser blob URL is runtime-only',
    };
  }

  if (normalizedUrl.startsWith('/api/bling')) {
    try {
      const parsedProxy = new URL(normalizedUrl, 'https://mercadodovale.com.br');
      const proxiedUrl = parsedProxy.searchParams.get('url') || normalizedUrl;
      if (isHttpUrl(proxiedUrl)) {
        const parsedSource = new URL(proxiedUrl);
        const result = classifyParsedHttpUrl(parsedSource, normalizedUrl, proxiedUrl);
        return {
          ...result,
          origin: result.origin === 'bling-s3' ? 'bling-s3-proxy' : result.origin,
          reason: 'Bling image proxy should be ingested into VPS media',
        };
      }
      return {
        origin: 'bling-s3-proxy',
        normalizedUrl,
        sourceUrl: proxiedUrl,
        redactedUrl: redactMediaUrl(proxiedUrl),
        shouldMigrate: true,
        reason: 'Bling image proxy should be reviewed because source URL is not absolute HTTP(S)',
      };
    } catch {
      return {
        origin: 'invalid',
        normalizedUrl,
        sourceUrl: normalizedUrl,
        redactedUrl: normalizedUrl,
        shouldMigrate: false,
        reason: 'Invalid Bling proxy URL',
      };
    }
  }

  if (normalizedUrl.startsWith('/')) {
    return {
      origin: 'relative',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: normalizedUrl,
      shouldMigrate: false,
      reason: 'Application-relative asset',
    };
  }

  if (!isHttpUrl(normalizedUrl)) {
    return {
      origin: 'invalid',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: normalizedUrl,
      shouldMigrate: false,
      reason: 'Value is not an HTTP(S), relative, data, or blob URL',
    };
  }

  try {
    return classifyParsedHttpUrl(new URL(normalizedUrl), normalizedUrl);
  } catch {
    return {
      origin: 'invalid',
      normalizedUrl,
      sourceUrl: normalizedUrl,
      redactedUrl: normalizedUrl,
      shouldMigrate: false,
      reason: 'URL parsing failed',
    };
  }
}

export function shouldMigrateMediaUrl(rawUrl) {
  return classifyMediaUrl(rawUrl).shouldMigrate;
}
