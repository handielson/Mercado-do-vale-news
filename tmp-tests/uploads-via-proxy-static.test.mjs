import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// 03/11/2026: fotos por cor do modelo davam "Unauthorized" (upload direto exigia SYNC key, que saiu do site em 01/11).
const files = {
  'services/modelColorImageUpload.ts': /buildVpsUrl\(path, \{ method: 'POST' \}\)/,
  'services/productImageBank.ts': /fetch\(proxyUrl\('\/images\/upload', 'POST'\)/,
  'services/blingService.ts': /fetch\(buildVpsUrl\('\/images\/upload', \{ method: 'POST' \}\)/,
  'services/uploadService.ts': /fetch\(buildVpsUrl\('\/banners\/upload', \{ method: 'POST' \}\)/,
};
for (const [file, pattern] of Object.entries(files)) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, pattern, `${file}: upload pelo proxy`);
  assert.doesNotMatch(source, /fetch\(`\$\{VPS_DIRECT_BASE_URL\}\/(images|banners)\/upload/, `${file}: sem upload direto que exige SYNC key`);
}
const server = readFileSync('vps_server.js', 'utf8');
assert.match(server, /contentType\.includes\('multipart\/form-data'\)\) \{\s*return request\.raw;/, 'proxy repassa multipart');
console.log('uploads via proxy static checks passed');
