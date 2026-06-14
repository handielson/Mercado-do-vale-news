import { readFileSync } from 'node:fs';

const source = readFileSync('services/modelColorImageUpload.ts', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('VPS_DIRECT_BASE_URL'),
  'Model color image uploads should know the direct VPS API base URL.',
);

assert(
  source.includes('function directVpsUrl') || source.includes('const directVpsUrl'),
  'Model color image uploads should build a direct VPS URL helper for multipart uploads.',
);

assert(
  source.includes("fetch(directVpsUrl('/images/upload')"),
  'Model color multipart uploads must call the VPS /images/upload endpoint directly, not through /api/vps-proxy.',
);

assert(
  source.includes('buildAuthHeaders') && source.includes('getVpsSyncHeaders'),
  'Direct model color uploads must keep existing admin auth and sync headers.',
);

assert(
  !source.includes("vpsClient.upload<{ url: string }>('/images/upload'"),
  'Model color image uploads must not send /images/upload through vpsClient.upload because production proxy loses multipart file/path.',
);

console.log('model color image direct upload static checks passed');
