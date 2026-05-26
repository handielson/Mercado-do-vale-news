import { readFileSync } from 'node:fs';

const source = readFileSync('services/productImageBank.ts', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  source.includes('VPS_DIRECT_BASE_URL'),
  'Image bank uploads should know the direct VPS API base URL.',
);

assert(
  source.includes('function directVpsUrl') || source.includes('const directVpsUrl'),
  'Image bank uploads should build a direct VPS URL helper for multipart uploads.',
);

assert(
  source.includes("fetch(directVpsUrl('/images/upload')"),
  'Multipart image uploads should call the VPS /images/upload endpoint directly, not through /api/vps-proxy.',
);

assert(
  source.includes("headers: await authHeaders()"),
  'Direct multipart uploads must still include the existing auth/sync headers.',
);

console.log('product image bank direct upload static checks passed');
