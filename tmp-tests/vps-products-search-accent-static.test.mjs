import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const serverPaths = ['vps_server.cjs', 'vps_server.js'];

for (const serverPath of serverPaths) {
  const source = readFileSync(serverPath, 'utf8');

  assert(
    source.includes('function normalizeCatalogProductSearchText'),
    `${serverPath} must expose a catalog product search normalizer`
  );
  assert(
    source.includes(".normalize('NFD')") && source.includes("replace(/[\\u0300-\\u036f]/g, '')"),
    `${serverPath} must strip accents from product search terms`
  );
  assert(
    source.includes('utf8mb4_unicode_ci'),
    `${serverPath} /products search must compare text with accent-insensitive collation`
  );
  assert(
    source.includes('const searchLike = `%${normalizedSearch}%`;'),
    `${serverPath} /products search must use the normalized search term in LIKE params`
  );
  assert(
    source.includes('brand COLLATE utf8mb4_unicode_ci LIKE ?'),
    `${serverPath} /products search should include brand in accent-insensitive matching`
  );
}

console.log('vps products accent-insensitive search static checks passed');
