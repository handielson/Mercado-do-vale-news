import assert from 'node:assert/strict';
import {
  buildTikTokBulkDebug,
  sanitizeTikTokBulkDebugText,
} from '../utils/tiktokBulkDebug.js';

const debug = buildTikTokBulkDebug({
  action: 'Publicar rascunhos',
  product: { id: 'local-1', name: 'Controle universal', sku: 'CUTIRRF' },
  link: { tiktok_product_id: 'tiktok-1' },
  error: new Error(
    '[VPS] 422 https://example.test/publish — {"detail":"TikTok Shop API failed: 12052104: atributo ausente","code":12052104,"request_id":"req-12345678"}'
  ),
  timestamp: '2026-07-30T03:00:00.000Z',
});

assert.match(debug, /Acao: Publicar rascunhos/, 'bulk debug must identify the requested action');
assert.match(debug, /Produto local ID: local-1/, 'bulk debug must identify the local product');
assert.match(debug, /Produto TikTok ID: tiktok-1/, 'bulk debug must identify the linked TikTok product');
assert.match(debug, /HTTP: 422/, 'bulk debug must extract the HTTP status');
assert.match(debug, /Codigo TikTok: 12052104/, 'bulk debug must extract the TikTok error code');
assert.match(debug, /Request ID: req-12345678/, 'bulk debug must extract the request id');

const sanitized = sanitizeTikTokBulkDebugText(
  'authorization: Bearer secret-token access_token=abc123 refresh_token:"def456" x-sync-key=xyz789'
);
assert.doesNotMatch(sanitized, /secret-token|abc123|def456|xyz789/, 'bulk debug must remove credentials');
assert.match(sanitized, /\[removido\]/, 'bulk debug must make secret removal visible');

console.log('TikTok Shop bulk debug checks passed');
