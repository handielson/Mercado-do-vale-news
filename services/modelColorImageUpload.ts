import { buildAuthHeaders } from './authSession';
import { VPS_DIRECT_BASE_URL, getVpsSyncHeaders } from './vpsProxyBase';

function directVpsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${VPS_DIRECT_BASE_URL}${normalizedPath}`;
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return buildAuthHeaders({
    ...getVpsSyncHeaders(),
    ...extra,
  });
}

function safePathSegment(value: string, fallback: string): string {
  const safe = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || fallback;
}

function extensionForFile(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/avif') return 'avif';
  return 'jpg';
}

export async function uploadModelColorImageToVps(
  file: File,
  modelId: string,
  colorId: string,
): Promise<string> {
  const formData = new FormData();
  const modelSegment = safePathSegment(modelId, 'model');
  const colorSegment = safePathSegment(colorId, 'color');
  const extension = extensionForFile(file);
  const uniqueSuffix = crypto.randomUUID();
  const fileName = `${colorSegment}-${uniqueSuffix}.${extension}`;

  formData.append('file', file, fileName);
  formData.append('path', `model-color/${modelSegment}/${fileName}`);

  const response = await fetch(directVpsUrl('/images/upload'), {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || response.statusText);
  }

  const result = await response.json() as { url: string };
  return result.url;
}
