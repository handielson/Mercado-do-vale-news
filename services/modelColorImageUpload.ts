import { vpsClient } from './vpsClient';

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

  const result = await vpsClient.upload<{ url: string }>('/images/upload', formData);
  return result.url;
}
